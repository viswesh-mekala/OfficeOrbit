import { callApi } from './api/apiClient';

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

export type AttendanceStatus = 

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
export const clockIn = async (
    status: 'present' | 'wfh',
    location: { latitude: number; longitude: number; address?: string }
) => {
    const { data, error, message } = await callApi<AttendanceLog>('check-in', {
        location,
        status,
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
export const clockOut = async () => {
    const { data, error, message } = await callApi<AttendanceLog>('check-out');

    if (error) {
        return { data: null, error: new Error(error) };
    }
    return { data, error: null, message };
};
