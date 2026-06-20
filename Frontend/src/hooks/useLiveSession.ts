/**
 * useLiveSession — Real-time session awareness for multi-session attendance.
 *
 * Responsibilities:
 *   1. Fetch session-status on mount → is_inside, live_duration_minutes, sessions[]
 *   2. Subscribe to attendance_sessions realtime → refetch on any session open/close
 *   3. When is_inside=true → tick live_duration_minutes every 60s so the timer is live
 *   4. Pause ticker when app goes to background; refetch + resume on foreground
 *
 * Single source of truth for:
 *   - isInside          → drives swipe direction (check-in vs check-out)
 *   - liveDurationMinutes → drives the open shift timer display
 *   - sessionCount       → drives "Session N" badge for lunch returns
 *   - sessions[]         → drives the session timeline on attendance screen
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../services/api/supabaseClient';
import { getSessionStatus } from '../services/AttendanceService';
import { useAuth } from '../store/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LiveSession = {
    id            : string;
    entered_at    : string;
    exited_at     : string | null;
    duration_minutes: number | null;
    source        : string;
};

type LiveSessionState = {
    isInside            : boolean;
    liveDurationMinutes : number;
    sessionCount        : number;
    sessions            : LiveSession[];
    loading             : boolean;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useLiveSession = (): LiveSessionState => {
    const { user, isProfileComplete } = useAuth();

    const [isInside, setIsInside]                       = useState(false);
    const [liveDurationMinutes, setLiveDurationMinutes] = useState(0);
    const [sessionCount, setSessionCount]               = useState(0);
    const [sessions, setSessions]                       = useState<LiveSession[]>([]);
    const [loading, setLoading]                         = useState(true);

    // Ticker interval ref — we keep one interval running when inside
    const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Fetch session-status from the API ─────────────────────────────────────

    const fetchStatus = useCallback(async () => {
        if (!user?.id || !isProfileComplete) return;
        try {
            const { data } = await getSessionStatus();
            if (!data) return;

            const inside   = data.is_inside ?? false;
            const duration = data.live_duration_minutes ?? 0;
            const slist    = (data.sessions ?? []) as LiveSession[];

            setIsInside(inside);
            setLiveDurationMinutes(duration);
            setSessionCount(slist.length);
            setSessions(slist);
        } catch { /* keep stale state on network error */ }
        finally   { setLoading(false); }
    }, [user?.id, isProfileComplete]);

    // ── Ticker: +1 minute every 60s when inside ───────────────────────────────

    const startTicker = useCallback(() => {
        if (tickerRef.current) return; // already running
        tickerRef.current = setInterval(() => {
            setLiveDurationMinutes((m) => m + 1);
        }, 60_000);
    }, []);

    const stopTicker = useCallback(() => {
        if (tickerRef.current) {
            clearInterval(tickerRef.current);
            tickerRef.current = null;
        }
    }, []);

    // Start / stop ticker based on isInside
    useEffect(() => {
        if (isInside) {
            startTicker();
        } else {
            stopTicker();
        }
        return stopTicker;
    }, [isInside, startTicker, stopTicker]);

    // ── Mount: initial fetch ──────────────────────────────────────────────────

    useEffect(() => {
        void fetchStatus();
    }, [fetchStatus]);

    // ── Supabase Realtime: attendance_sessions ────────────────────────────────
    // Any session INSERT (new check-in or lunch return) or UPDATE (exit_at set)
    // triggers a fresh session-status fetch so is_inside and live_duration_minutes
    // update within ~1s of the DB write — even when the DB write happened from
    // a background geofence task while the app was minimised.

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`live-session-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event : '*',
                    schema: 'public',
                    table : 'attendance_sessions',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    // Any session change → re-sync everything
                    void fetchStatus();
                },
            )
            .on(
                'postgres_changes',
                {
                    event : 'UPDATE',
                    schema: 'public',
                    table : 'attendance_records',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    // Daily record updated (e.g. manual checkout) → re-sync
                    void fetchStatus();
                },
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id, fetchStatus]);

    // ── AppState: pause ticker & re-sync when returning to foreground ─────────

    useEffect(() => {
        let prevState: AppStateStatus = AppState.currentState;

        const sub = AppState.addEventListener('change', (nextState) => {
            if (prevState.match(/inactive|background/) && nextState === 'active') {
                // Came to foreground — refetch real data (ticker may have drifted)
                void fetchStatus();
            }
            if (nextState.match(/inactive|background/)) {
                stopTicker(); // don't waste battery incrementing in background
            } else if (nextState === 'active' && isInside) {
                startTicker(); // resume after fetchStatus updates isInside
            }
            prevState = nextState;
        });

        return () => sub.remove();
    }, [fetchStatus, isInside, startTicker, stopTicker]);

    return { isInside, liveDurationMinutes, sessionCount, sessions, loading };
};
