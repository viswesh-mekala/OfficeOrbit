import { useState, useEffect, useCallback } from 'react';
import { getTodayAttendance, getWeeklyAttendance, AttendanceLog } from '../services/AttendanceService';
import { useAuth } from '../store/AuthContext';

/**
 * Hook for attendance state management.
 * Fetches today's log and weekly history via Edge Function APIs.
 * No userId needed — JWT handles identity.
 */
export const useAttendance = () => {
    const { user, isProfileComplete } = useAuth();
    const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
    const [weeklyLogs, setWeeklyLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAttendance = useCallback(async () => {
        if (!user?.id || !isProfileComplete) return;
        
        try {
            // Fetch today's status (no userId — JWT handles it)
            const { data: todayData } = await getTodayAttendance();
            setTodayLog(todayData || null);

            // Fetch weekly stats
            const { data: weeklyData } = await getWeeklyAttendance(7);
            setWeeklyLogs(weeklyData || []);
        } catch (_error) {}
    }, [user?.id, isProfileComplete]);

    const refresh = async () => {
        setRefreshing(true);
        await fetchAttendance();
        setRefreshing(false);
    };

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            await fetchAttendance();
            if (mounted) setLoading(false);
        };
        load();
        return () => { mounted = false; };
    }, [fetchAttendance]);

    return {
        todayLog,
        weeklyLogs,
        loading,
        refreshing,
        refresh,
    };
};
