import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { processAttendanceLocationSamples } from './AttendanceAutomation';

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

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error('[Background] Task Error:', error);
        return;
    }

    if (data) {
        try {
            const { locations } = data as { locations?: Location.LocationObject[] };
            if (!locations || locations.length === 0) return;
            await processAttendanceLocationSamples(locations, 'background');
        } catch (err) {
            console.error('[Background] Logic Error:', err);
        }
    }
});
