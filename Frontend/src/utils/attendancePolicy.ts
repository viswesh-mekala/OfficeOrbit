import type { AttendanceLog } from '../services/AttendanceService';

/**
 * Calendar edits (attendance-update) set a day status but clear check-in/out timestamps.
 * In that state, location-based check-in/out is misleading and should be disabled.
 */
export const isCalendarManagedDay = (log: AttendanceLog | null | undefined): boolean => {
    if (!log) return false;
    // Treat "absent" as "no record" in UI; it should not be calendar-managed in this sense.
    if (log.status === 'absent') return false;
    return !log.check_in && !log.check_out;
};

export const liveDurationMinutes = (log: AttendanceLog | null | undefined): number | null => {
    if (!log?.check_in) return null;
    if (log.check_out) return log.duration_minutes ?? null;
    const start = new Date(log.check_in).getTime();
    if (Number.isNaN(start)) return null;
    return Math.max(0, Math.floor((Date.now() - start) / 60000));
};
