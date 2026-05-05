import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { GEOFENCE_REGION_TASK, ACTIVE_POLLING_TASK, stopActivePolling } from './LocationService';
import { handleGeofenceEnter, handleGeofenceExit, handleActivePollingSample } from './AttendanceAutomation';

// Note: Notifications.setNotificationHandler is configured in NotificationService.ts


// ── Task 1: OS Geofence Region Events ────────────────────────────────────────
//
// Fired by the OS (even if app is killed) when the user crosses the 500m fence.
// event.region.state will be 'inside' (enter) or 'outside' (exit).
//
TaskManager.defineTask(GEOFENCE_REGION_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error('[GeofenceTask] Error:', error);
        return;
    }
    if (!data) return;

    const { eventType } = data as {
        eventType: Location.GeofencingEventType;
    };

    try {
        if (eventType === Location.GeofencingEventType.Enter) {
            // Dwell confirmation is handled inside handleGeofenceEnter
            // (schedules a 5-min GPS sample before calling the API)
            await handleGeofenceEnter();
        } else if (eventType === Location.GeofencingEventType.Exit) {
            await handleGeofenceExit();
        }
    } catch (err) {
        console.error('[GeofenceTask] Logic error:', err);
    }
});

// ── Task 2: Active Background Polling (Dwell & Exit Confirmation) ────────────
//
// Short-lived polling task started after GEOFENCE_ENTER or GEOFENCE_EXIT events.
// Samples location every 3 min to confirm dwell or exit.
// Stops itself after confirming or after timeout.
//
TaskManager.defineTask(ACTIVE_POLLING_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error('[ActivePollingTask] Error:', error);
        return;
    }
    if (!data) return;

    try {
        const { locations } = data as { locations?: Location.LocationObject[] };
        if (!locations || locations.length === 0) return;

        const finished = await handleActivePollingSample(locations[locations.length - 1]);
        if (finished) {
            // Task completed its job — stop polling
            await stopActivePolling();
        }
    } catch (err) {
        console.error('[ActivePollingTask] Logic error:', err);
    }
});
