import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { addNotification } from './NotificationService';

export const GEOFENCE_REGION_TASK = 'OFFICEORBIT_GEOFENCE_REGION';
export const ACTIVE_POLLING_TASK  = 'OFFICEORBIT_ACTIVE_POLLING';
const LEGACY_GEOFENCE_TASK        = 'GEOFENCE_TASK'; // Ghost task from previous versions

// ── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Unregisters legacy tasks that might be lingering on the device
 * from previous versions of the app.
 */
export const unregisterLegacyTasks = async () => {
    try {
        const registered = await TaskManager.getRegisteredTasksAsync();
        const names = registered.map(t => t.taskName);
        
        if (names.includes(LEGACY_GEOFENCE_TASK)) {
            await Location.stopGeofencingAsync(LEGACY_GEOFENCE_TASK);
            console.log('[LocationService] Unregistered legacy GEOFENCE_TASK');
        }
    } catch (err) {
        // Silent fail — just a cleanup
    }
};

// ── Permissions ──────────────────────────────────────────────────────────────

export const requestPermissions = async (): Promise<boolean> => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
        Alert.alert(
            'Location Required',
            'OfficeOrbit uses your location to automatically track office attendance. Without it, auto-attendance won\'t work.\n\nPlease grant location access.',
            [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() },
            ],
        );
        await addNotification({
            title: 'Location access required',
            body: 'OfficeOrbit needs location access to verify office check-ins and automate attendance.',
            type: 'location',
        });
        return false;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
        Alert.alert(
            'Background Location Needed',
            'To auto-detect office arrivals, OfficeOrbit needs "Allow all the time" location access.\n\nWithout this, you\'ll need to swipe manually.',
            [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings() },
            ],
        );
        await addNotification({
            title: 'Background location needed',
            body: 'For automatic office check-in, OfficeOrbit needs "Allow all the time" location access.',
            type: 'location',
        });
        return false;
    }
    return true;
};

// ── Geofence Registration ─────────────────────────────────────────────────────

/**
 * Registers the OS-native geofence for the user's office location.
 * The OS (not the app) monitors this region and fires GEOFENCE_REGION_TASK
 * on enter/exit — even if the app is killed.
 *
 * @param officeLat  Office latitude from user profile
 * @param officeLng  Office longitude from user profile
 */
export const registerGeofence = async (
    officeLat: number,
    officeLng: number,
): Promise<void> => {
    if (AppState.currentState !== 'active') return;

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
        // Stop any stale geofence first
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_REGION_TASK);
        if (isRegistered) {
            await Location.stopGeofencingAsync(GEOFENCE_REGION_TASK);
        }

        await Location.startGeofencingAsync(GEOFENCE_REGION_TASK, [
            {
                latitude  : officeLat,
                longitude : officeLng,
                radius    : 500,   // 500m geofence
                notifyOnEnter: true,
                notifyOnExit : true,
            },
        ]);
    } catch (error: any) {
        if (!error?.message?.includes('foreground service') && !error?.message?.includes('background')) {
            console.error('[LocationService] Failed to register geofence:', error);
        }
    }
};

export const stopGeofence = async (): Promise<void> => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_REGION_TASK);
        if (isRegistered) {
            await Location.stopGeofencingAsync(GEOFENCE_REGION_TASK);
        }
    } catch (error) {
        console.error('[LocationService] Failed to stop geofence:', error);
    }
};

// ── Active Background Polling (Dwell & Exit Confirmation) ─────────────────────

/**
 * Starts a short-lived location polling task to confirm either:
 * 1. The user has stayed in the office for > 5 mins (Enter Dwell)
 * 2. The user has actually left the office (Exit Confirm)
 * Polls every 3 min. Stops itself once confirmation is complete.
 */
export const startActivePolling = async (): Promise<void> => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(ACTIVE_POLLING_TASK);
        if (isRegistered) return;

        await Location.startLocationUpdatesAsync(ACTIVE_POLLING_TASK, {
            accuracy              : Location.Accuracy.Balanced,
            distanceInterval      : 0,
            deferredUpdatesInterval: 3 * 60 * 1000,   // sample every 3 min
            deferredUpdatesDistance: 0,
            foregroundService: {
                notificationTitle: 'OfficeOrbit',
                notificationBody : 'Verifying attendance...',
            },
        });
    } catch (error) {
        console.error('[LocationService] Failed to start active polling:', error);
    }
};

export const stopActivePolling = async (): Promise<void> => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(ACTIVE_POLLING_TASK);
        if (isRegistered) {
            await Location.stopLocationUpdatesAsync(ACTIVE_POLLING_TASK);
        }
    } catch (error) {
        console.error('[LocationService] Failed to stop active polling:', error);
    }
};
