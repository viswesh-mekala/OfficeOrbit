import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { Alert, Linking, Platform } from 'react-native';
import { addNotification } from './NotificationService';
import { queueAttendanceRecovery } from './AttendanceRecoveryService';
import { getDistanceFromLatLonInMeters } from '../utils/locationUtils';

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
        await queueAttendanceRecovery({
            action: 'checkin',
            source: 'auto',
            reason: 'location_permission',
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
        await queueAttendanceRecovery({
            action: 'checkin',
            source: 'auto',
            reason: 'background_location_permission',
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
): Promise<boolean> => {
    if (AppState.currentState !== 'active') return false;

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return false;

    try {
        // Cache coordinates locally in SecureStore so background tasks can read offline-first
        try {
            await SecureStore.setItemAsync('officeorbit_office_location_cache', JSON.stringify({
                latitude  : officeLat,
                longitude : officeLng,
            }));
        } catch (_err) {
            // Ignore cache storage failure
        }

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
        return true;
    } catch (error: any) {
        if (!error?.message?.includes('foreground service') && !error?.message?.includes('background')) {
            console.error('[LocationService] Failed to register geofence:', error);
        }
        return false;
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
        // IMPORTANT: foregroundService MUST always be set, regardless of AppState.
        // When GEOFENCE_REGION_TASK fires with the app killed/backgrounded, AppState.currentState
        // is NOT 'active'. Without foregroundService, Android 11+ throws
        // ForegroundServiceStartNotAllowedException — which was previously swallowed silently
        // by the catch block, causing the entire dwell-confirmation chain to never run.
        const options: Location.LocationOptions = {
            accuracy               : Location.Accuracy.Balanced,
            distanceInterval       : 0,
            timeInterval           : 60 * 1000,
            deferredUpdatesInterval: 3 * 60 * 1000,   // sample every 3 min
            deferredUpdatesDistance: 0,
            pausesUpdatesAutomatically: false,
            foregroundService: {
                notificationTitle: 'OfficeOrbit',
                notificationBody : 'Verifying office attendance...',
                notificationColor: '#5B4DFF',
            },
        };

        await Location.startLocationUpdatesAsync(ACTIVE_POLLING_TASK, options);
    } catch (error: any) {
        // Log the real error — don't swallow silently
        console.error('[LocationService] Failed to start active polling:', error?.message ?? error);
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

// ── JS-Thread Location Watcher (Free / Pro Alive State Tracking) ─────────────

let activeLocationWatcher: Location.LocationSubscription | null = null;
let wasInsideOffice = false;

/**
 * Starts a Javascript-thread-bound location subscription.
 * Runs only while the app is alive or minimized in background RAM.
 * Stops automatically when the app is swipe-closed (process is killed).
 */
export const startLiveProcessWatcher = async (
    officeLat: number,
    officeLng: number,
    onEnter: () => void | Promise<void>,
    onExit: () => void | Promise<void>,
): Promise<void> => {
    if (activeLocationWatcher) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        console.warn('[LocationService] Live watcher skipped: Foreground permission denied');
        return;
    }

    try {
        // Sample initial position to set baseline state
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const initialDistance = getDistanceFromLatLonInMeters(
            current.coords.latitude,
            current.coords.longitude,
            officeLat,
            officeLng
        );
        wasInsideOffice = initialDistance <= 500;
    } catch (err) {
        wasInsideOffice = false;
    }

    activeLocationWatcher = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60 * 1000, // check every minute
            distanceInterval: 100,    // check every 100 meters
        },
        async (location) => {
            const distance = getDistanceFromLatLonInMeters(
                location.coords.latitude,
                location.coords.longitude,
                officeLat,
                officeLng
            );

            const isInsideNow = distance <= 500;

            if (isInsideNow && !wasInsideOffice) {
                wasInsideOffice = true;
                await onEnter();
            } else if (!isInsideNow && wasInsideOffice) {
                wasInsideOffice = false;
                await onExit();
            }
        }
    );
    console.log('[LocationService] Live process location watcher started successfully');
};

/**
 * Cleanly stops and releases the active location watcher subscription.
 */
export const stopLiveProcessWatcher = (): void => {
    if (activeLocationWatcher) {
        activeLocationWatcher.remove();
        activeLocationWatcher = null;
        console.log('[LocationService] Live process location watcher stopped successfully');
    }
};

