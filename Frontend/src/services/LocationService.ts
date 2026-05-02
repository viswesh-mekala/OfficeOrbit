import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { GEOFENCE_TASK } from './BackgroundTasks';
import { processAttendanceLocationSamples } from './AttendanceAutomation';
import { addNotification } from './NotificationService';

export const requestPermissions = async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
        await addNotification({
            title: 'Location access required',
            body: 'OfficeOrbit needs location access to verify office check-ins and automate attendance. Please enable location permissions in your device settings.',
            type: 'location',
        });
        Alert.alert(
            'Location Required',
            'OfficeOrbit uses your location to automatically track office attendance. Without it, check-in verification and auto-attendance won\'t work.\n\nPlease grant location access.',
            [
                { text: 'Not Now', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (Platform.OS === 'ios') {
                            Linking.openURL('app-settings:');
                        } else {
                            Linking.openSettings();
                        }
                    },
                },
            ],
        );
        return false;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
        await addNotification({
            title: 'Background location needed',
            body: 'For automatic office check-in, OfficeOrbit needs "Allow all the time" location access. Without it, you\'ll need to manually check in each day.',
            type: 'location',
        });
        Alert.alert(
            'Background Location Needed',
            'To automatically detect when you arrive at the office and mark attendance, OfficeOrbit needs "Allow all the time" location access.\n\nWithout this, auto check-in won\'t work and you\'ll need to swipe manually each day.',
            [
                { text: 'Not Now', style: 'cancel' },
                {
                    text: 'Open Settings',
                    onPress: () => {
                        if (Platform.OS === 'ios') {
                            Linking.openURL('app-settings:');
                        } else {
                            Linking.openSettings();
                        }
                    },
                },
            ],
        );
        return false;
    }
    return true;
};

export const startBackgroundUpdate = async () => {
    // Android 12+ forbids starting a foreground service when the app is backgrounded.
    // Only attempt when the app is actively in the foreground.
    if (AppState.currentState !== 'active') return;

    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
        if (isRegistered) {
            return;
        }

        await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 100,
            deferredUpdatesInterval: 10 * 60 * 1000,
            deferredUpdatesDistance: 100,
            foregroundService: {
                notificationTitle: "OfficeOrbit is active",
                notificationBody: "Monitoring location for auto-attendance.",
            }
        });
    } catch (error: any) {
        // Gracefully handle the foreground-service-from-background race condition
        if (error?.message?.includes('foreground service') || error?.message?.includes('background')) {
            console.warn('LocationService: skipped — app is not in foreground');
        } else {
            console.error('Error starting background location:', error);
        }
    }
};

export const runAttendanceOneShot = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
        const sample = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });
        await processAttendanceLocationSamples([sample], 'oneshot');
    } catch (error) {
        console.error('Error running attendance one-shot:', error);
    }
};

export const stopBackgroundUpdate = async () => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
        if (isRegistered) {
            await Location.stopLocationUpdatesAsync(GEOFENCE_TASK);
        }
    } catch (error) {
        console.error('Error stopping background location:', error);
    }
};
