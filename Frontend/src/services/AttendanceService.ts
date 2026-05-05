import { callApi } from './api/apiClient';
import * as SecureStore from 'expo-secure-store';

/**
 * Attendance Service — all attendance operations through Edge Functions.
 * No direct database access.
 */

export interface AttendanceLog {
    id: string;
    user_id: string;
    date: string;
    check_in: string | null;
    check_out: string | null;
    status: 'present' | 'wfh' | 'leave' | 'holiday' | 'absent';
    location_check_in: {
        address: string;
        at_office?: boolean;
    } | null;
    duration_minutes: number;
}


export type AttendanceSession = {
    id: string;
    entered_at: string;
    exited_at: string | null;
    duration_minutes: number | null;
    source: 'geofence' | 'manual';
};

export type SessionStatusResponse = {
    daily_record          : AttendanceLog | null;
    sessions              : AttendanceSession[];
    live_duration_minutes : number;
    is_inside             : boolean;
};

// ── Offline Queue ────────────────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = 'officeorbit_attendance_queue_v1';

type QueuedAction = {
    id          : string;
    action      : 'checkin' | 'checkout';
    payload     : Record<string, unknown>;
    queuedAtMs  : number;
};

const loadQueue = async (): Promise<QueuedAction[]> => {
    try {
        const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as QueuedAction[];
    } catch { return []; }
};

const saveQueue = async (queue: QueuedAction[]): Promise<void> => {
    try {
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch { /* noop */ }
};

/**
 * Flush any queued check-in / check-out actions when network is available.
 * Call this on app foreground or after a successful API call.
 */
export const flushOfflineQueue = async (): Promise<void> => {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h max age
    const now = Date.now();
    const remaining: QueuedAction[] = [];

    for (const item of queue) {
        if (now - item.queuedAtMs > MAX_AGE_MS) continue; // too old, discard
        try {
            const fn = item.action === 'checkin' ? 'check-in' : 'check-out';
            const { error } = await callApi(fn, item.payload);
            if (error) remaining.push(item); // retry later
        } catch {
            remaining.push(item);
        }
    }
    await saveQueue(remaining);
};


// ── Get Today's Attendance ──
export const getTodayAttendance = async () => {
    const { data, error } = await callApi<AttendanceLog>('attendance-today');
    if (error) {
        return { data: null, error: new Error(error) };
    }
    return { data: data as AttendanceLog | null, error: null };
};

// ── Get Attendance History ──
export const getWeeklyAttendance = async (limit = 7) => {
    const { data, error } = await callApi<AttendanceLog[]>('attendance-history', { limit });
    if (error) {
        return { data: null, error: new Error(error) };
    }
    return { data: data as AttendanceLog[] || [], error: null };
};

// ── Check In (Office or WFH) ──
// source: 'manual' (swipe) or 'geofence' (auto). Defaults to 'manual'.
export const clockIn = async (
    status: 'present' | 'wfh',
    location: { latitude: number; longitude: number; address?: string },
    source: 'manual' | 'geofence' = 'manual',
) => {
    const { data, error, message } = await callApi<AttendanceLog>('check-in', {
        location,
        status,
        source,
    });

    if (error) {
        return { data: null, error: new Error(error) };
    }
    return { data, error: null, message };
};


// ── Manually Update Attendance Day Status ──
export const updateAttendanceDay = async (
    date: string,
    status: AttendanceStatus
) => {
    const { data, error, message } = await callApi<AttendanceLog>('attendance-update', {
        date,
        status,
    });

    if (error) {
        return { data: null, error: new Error(error), message };
    }
    return { data, error: null, message };
};

// ── Check Out ──
// source: 'manual' (swipe) or 'geofence' (auto). Defaults to 'manual'.
export const clockOut = async (source: 'manual' | 'geofence' = 'manual') => {
    const { data, error, message } = await callApi<AttendanceLog>('check-out', { source });

    if (error) {
        return { data: null, error: new Error(error) };
    }
    return { data, error: null, message };
};

// ── Session Status (live duration + sessions list) ──
export const getSessionStatus = async () => {
    const { data, error } = await callApi<SessionStatusResponse>('session-status');
    if (error) {
        return { data: null, error: new Error(error) };
    }
    return { data: data as SessionStatusResponse | null, error: null };
};

export type AttendanceStatus = 'present' | 'wfh' | 'leave' | 'holiday' | 'absent';
