import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { callApi } from './api/apiClient';
import { clockIn } from './AttendanceService';
import { getDistanceFromLatLonInMeters } from '../utils/locationUtils';

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

        console.log('[Background] Location Update:', location.coords);

        try {
            // 1. Get User Profile via API (no direct DB access)
            const { data: profile, error: profileError } = await callApi('profile-get');

            if (profileError || !profile?.company_location) {
                console.log('[Background] No profile or company location set.');
                return;
            }

            // 2. Time Window Check — use profile's office hours
            const now = new Date();
            const currentHour = now.getHours();
            const startHour = parseHour(profile.office_window_start) ?? 8;
            const endHour = parseHour(profile.office_window_end) ?? 20;

            if (currentHour < startHour || currentHour > endHour) {
                console.log(`[Background] Outside monitoring hours (${startHour}-${endHour}).`);
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

            console.log(`[Background] Distance to Office: ${Math.round(distance)}m`);

            // 4. Check Today's Log via API (no direct DB access)
            const { data: todayLog } = await callApi('attendance-today');

            // Skip on holidays/leave
            if (todayLog && (todayLog.status === 'holiday' || todayLog.status === 'leave')) {
                console.log('[Background] Holiday/Leave marked. Skipping auto-check-in.');
                return;
            }

            const RADIUS_METERS = 500;
            
            if (distance <= RADIUS_METERS) {
                // INSIDE geofence
                if (!todayLog) {
                    console.log('[Background] Inside Geofence. Attempting Auto-Check-In...');
                    
                    const { error: checkInError } = await clockIn('present', {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        address: 'Auto-Detected at Office'
                    });

                    if (checkInError) {
                        console.error('[Background] Auto-Check-In Failed:', checkInError.message);
                    } else {
                        console.log('[Background] Auto-Check-In Successful');
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
                    // Future: Debounced auto-checkout logic
                    console.log('[Background] User left office perimeter.');
                }
            }

        } catch (err) {
            console.error('[Background] Logic Error:', err);
        }
    }
});
