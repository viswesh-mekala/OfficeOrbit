import { useEffect, useState } from 'react';
import {
    clearPendingAttendanceRecovery,
    getPendingAttendanceRecovery,
    PendingAttendanceRecovery,
    subscribeAttendanceRecovery,
} from '../services/AttendanceRecoveryService';
import { useAuth } from '../store/AuthContext';

export const useAttendanceRecovery = () => {
    const { user } = useAuth();
    const [pendingRecovery, setPendingRecovery] = useState<PendingAttendanceRecovery | null>(null);

    useEffect(() => {
        let mounted = true;

        getPendingAttendanceRecovery()
            .then((recovery) => {
                if (mounted) setPendingRecovery(recovery);
            })
            .catch(() => {
                if (mounted) setPendingRecovery(null);
            });

        const unsubscribe = subscribeAttendanceRecovery((recovery) => {
            if (mounted) setPendingRecovery(recovery);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [user?.id]);

    return {
        pendingRecovery,
        clearRecovery: clearPendingAttendanceRecovery,
    };
};
