/**
 * useAttendance — Industry-standard attendance state hook.
 *
 * Architectural patterns implemented (MNC-grade):
 *
 * 1. CACHE-FIRST (Stale-While-Revalidate)
 *    Show SecureStore cache instantly on every app open (<50ms).
 *    Fresh data loads silently in the background and swaps in.
 *    Pattern used by: Notion, Linear, Slack.
 *
 * 2. SUPABASE REALTIME SUBSCRIPTION
 *    Subscribes to postgres_changes on attendance_records.
 *    When a geofence triggers a DB write (even while app is backgrounded
 *    and then foregrounded), the UI updates automatically with zero polling.
 *    Pattern used by: Figma, Notion, Firebase apps.
 *
 * 3. OPTIMISTIC UI (implemented via optimisticUpdate() helper returned by hook)
 *    The Dashboard swipe action calls optimisticUpdate() BEFORE the API response.
 *    UI reflects the change instantly. On API failure, it reverts to prior state.
 *    Pattern used by: Gmail, Uber, Slack message reactions.
 *
 * 4. APPSTATE-BASED FOREGROUND REFRESH
 *    Re-fetches once when the app comes to the foreground from background.
 *    Does NOT re-fetch on every tab/screen focus (which hammers the API).
 *    Pattern used by: every major iOS/Android app.
 *
 * 5. IN-FLIGHT DEDUPLICATION
 *    fetchRef guards prevent concurrent duplicate fetches from firing
 *    (e.g. mount + AppState foreground firing simultaneously).
 *    Pattern used by: TanStack Query, SWR.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getTodayAttendance, getWeeklyAttendance, AttendanceLog, flushOfflineQueue } from '../services/AttendanceService';
import { useAuth } from '../store/AuthContext';
import { setActiveUserIdForStreakStorage } from '../utils/wfoStreak';
import { supabase } from '../services/api/supabaseClient';

// ── Cache config ──────────────────────────────────────────────────────────────

const CACHE_TODAY  = 'officeorbit_cache_today_v2';
const CACHE_WEEKLY = 'officeorbit_cache_weekly_v2';

type Envelope<T> = { data: T; savedAt: number; userId: string };

const readCache = async <T>(key: string, userId: string): Promise<T | null> => {
    try {
        const raw = await SecureStore.getItemAsync(key);
        if (!raw) return null;
        const env = JSON.parse(raw) as Envelope<T>;
        return env.userId === userId ? env.data : null;
    } catch { return null; }
};

const writeCache = async <T>(key: string, data: T, userId: string): Promise<void> => {
    try {
        await SecureStore.setItemAsync(key, JSON.stringify({ data, savedAt: Date.now(), userId }));
    } catch { /* non-fatal */ }
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useAttendance = () => {
    const { user, isProfileComplete } = useAuth();

    const [todayLog, setTodayLog]     = useState<AttendanceLog | null>(null);
    const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
    // loading=true ONLY when there is zero cache (true first-ever launch blank screen)
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // In-flight deduplication guard
    const isFetching = useRef(false);

    // ── 1. Cache-first load ───────────────────────────────────────────────────
    const loadCache = useCallback(async () => {
        if (!user?.id) return;
        const [cachedToday, cachedWeekly] = await Promise.all([
            readCache<AttendanceLog | null>(CACHE_TODAY, user.id),
            readCache<AttendanceLog[]>(CACHE_WEEKLY, user.id),
        ]);
        if (cachedToday  !== null) setTodayLog(cachedToday);
        if (cachedWeekly !== null) setWeeklyLogs(cachedWeekly);
        // If any cache exists → stop the skeleton spinner immediately
        if (cachedToday !== null || cachedWeekly !== null) setLoading(false);
    }, [user?.id]);

    // ── 2. Background network fetch (always parallel) ─────────────────────────
    const fetchFresh = useCallback(async () => {
        if (!user?.id || !isProfileComplete) return;
        if (isFetching.current) return;   // ← deduplication
        isFetching.current = true;

        await setActiveUserIdForStreakStorage(user.id);

        try {
            // First flush any offline queued items to guarantee UI updates reflect recent actions
            await flushOfflineQueue();

            // Both requests fire at the same time — never sequential
            const [{ data: todayData }, { data: weeklyData }] = await Promise.all([
                getTodayAttendance(),
                getWeeklyAttendance(400),
            ]);

            const today  = todayData  ?? null;
            const weekly = weeklyData ?? [];

            setTodayLog(today);
            setWeeklyLogs(weekly);

            // Persist fresh data to cache for next cold open
            await Promise.all([
                writeCache(CACHE_TODAY,  today,  user.id),
                writeCache(CACHE_WEEKLY, weekly, user.id),
            ]);
        } catch { /* keep showing cached data on network failure */ }
        finally {
            setLoading(false);
            isFetching.current = false;
        }
    }, [user?.id, isProfileComplete]);

    // ── 3. Optimistic update helper ───────────────────────────────────────────
    // Dashboard calls this BEFORE the API responds.
    // Returns a rollback function the caller uses on API failure.
    const optimisticUpdate = useCallback((patch: Partial<AttendanceLog>) => {
        const prev = todayLog;
        setTodayLog((cur) => cur ? { ...cur, ...patch } : (patch as AttendanceLog));
        // Rollback: call the returned function if the API fails
        return () => setTodayLog(prev);
    }, [todayLog]);

    // ── 4. Mount: cache → then background fetch ───────────────────────────────
    useEffect(() => {
        let mounted = true;
        const boot = async () => {
            await loadCache();               // ~50ms — UI renders with cached data
            if (mounted) fetchFresh();       // background — no await, fires silently
        };
        boot();
        return () => { mounted = false; };
    }, [loadCache, fetchFresh]);

    // ── 5. Supabase Realtime subscription ─────────────────────────────────────
    // Listens for any INSERT/UPDATE on attendance_records for this user.
    // Fires automatically when geofence writes to DB — even while app is open.
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`attendance-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event : '*',
                    schema: 'public',
                    table : 'attendance_records',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    // Merge the changed row directly into state — no extra API call needed
                    const updated = payload.new as AttendanceLog;
                    if (updated) {
                        setTodayLog(updated);
                        // Also refresh weekly so compliance/streak stays accurate
                        fetchFresh();
                    }
                },
            )
            .on(
                'postgres_changes',
                {
                    // attendance_sessions changes update sessions_count and check_out
                    // on the daily record (via recompute_daily_summary on the backend).
                    // Listen here so that when a lunch-return session opens or an
                    // auto-checkout closes a session, todayLog re-syncs immediately.
                    event : '*',
                    schema: 'public',
                    table : 'attendance_sessions',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    // Session changed → refresh to pick up new sessions_count / check_out
                    fetchFresh();
                },
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };

    }, [user?.id, fetchFresh]);

    // ── 6. AppState foreground refresh ────────────────────────────────────────
    // Re-fetches once when the user brings the app to the foreground.
    // Does NOT fire on every screen focus — that's the key difference.
    useEffect(() => {
        let prevState: AppStateStatus = AppState.currentState;

        const sub = AppState.addEventListener('change', (nextState) => {
            if (prevState.match(/inactive|background/) && nextState === 'active') {
                fetchFresh();
            }
            prevState = nextState;
        });

        return () => sub.remove();
    }, [fetchFresh]);

    // ── Pull-to-refresh ───────────────────────────────────────────────────────
    const refresh = useCallback(async () => {
        setRefreshing(true);
        await fetchFresh();
        setRefreshing(false);
    }, [fetchFresh]);

    return { todayLog, weeklyLogs, loading, refreshing, refresh, optimisticUpdate };
};
