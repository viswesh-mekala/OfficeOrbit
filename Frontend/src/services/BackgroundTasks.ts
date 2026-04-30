import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { callApi } from './api/apiClient';
import { clockIn } from './AttendanceService';
import { getDistanceFromLatLonInMeters } from '../utils/locationUtils';
import { addNotification } from './NotificationService';

export const GEOFENCE_TASK = 'GEOFENCE_TASK';

// Configure Notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Parse a time string like "09:00" or "18:00" into hours.
 */
const parseHour = (timeStr: string | null | undefined): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    return parts.length >= 1 ? parseInt(parts[0], 10) : null;
};

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error('[Background] Task Error:', error);
        return;
    }

    if (data) {
        const { locations } = data;
        const location = locations[0];
        
        if (!location) return;

        try {
            // 1. Get User Profile via API (no direct DB access)
            const { data: profile, error: profileError } = await callApi('profile-get');

            if (profileError || !profile?.company_location) {
                return;
            }

            // 2. Time Window Check — use profile's office hours
            const now = new Date();
            const currentHour = now.getHours();
            const startHour = parseHour(profile.office_window_start) ?? 8;
            const endHour = parseHour(profile.office_window_end) ?? 20;

            if (currentHour < startHour || currentHour > endHour) {
                return;
            }

            // 3. Calculate Distance
            const officeLat = profile.company_location.latitude;
            const officeLng = profile.company_location.longitude;
            const distance = getDistanceFromLatLonInMeters(
                location.coords.latitude,
                location.coords.longitude,
                officeLat,
                officeLng
            );

            // 4. Check Today's Log via API (no direct DB access)
            const { data: todayLog } = await callApi('attendance-today');

            // Skip on holidays/leave
            if (todayLog && (todayLog.status === 'holiday' || todayLog.status === 'leave')) {
                return;
            }

            const RADIUS_METERS = 500;
            
            if (distance <= RADIUS_METERS) {
                // INSIDE geofence
                if (!todayLog) {
                    const { error: checkInError } = await clockIn('present', {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        address: 'Auto-Detected at Office'
                    });

                    if (checkInError) {
                        console.error('[Background] Auto-Check-In Failed:', checkInError.message);
                        await addNotification({
                            title: 'Auto check-in failed',
                            body: checkInError.message || 'Automatic office check-in could not be completed.',
                            type: 'automation',
                        });
                    } else {
                        await addNotification({
                            title: 'Auto check-in completed',
                            body: 'You arrived at office and attendance was marked automatically.',
                            type: 'automation',
                        });
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: "📍 You've arrived!",
                                body: "Welcome to OfficeOrbit. You have been checked in.",
                            },
                            trigger: null,
                        });
                    }
                }
            } else {
                // OUTSIDE geofence
                if (todayLog && !todayLog.check_out && todayLog.status === 'present') {
                    await addNotification({
                        title: 'Outside office boundary detected',
                        body: 'Location appears outside office area while you are checked in.',
                        type: 'location',
                    });
                    // Future: Debounced auto-checkout logic
                }
            }

        } catch (err) {
            console.error('[Background] Logic Error:', err);
        }
    }
});
