import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';
import { GEOFENCE_TASK } from './BackgroundTasks';
import { processAttendanceLocationSamples } from './AttendanceAutomation';

export const requestPermissions = async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
        Alert.alert('Location Required', 'Allow location access so OfficeOrbit can verify office check-ins.');
        return false;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
        Alert.alert('Background Access Required', 'Select "Allow all the time" if you want automatic office check-in.');
        return false;
    }
    return true;
};

export const startBackgroundUpdate = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
        if (isRegistered) {
            return;
        }

        await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
            accuracy: Location.Accuracy.Balanced, // Balanced for battery (approx 100m)
            distanceInterval: 100, // Update every 100 meters
            deferredUpdatesInterval: 10 * 60 * 1000, // Minimum 10 minutes between updates (Android)
            deferredUpdatesDistance: 100, // Minimum 100 meters
            foregroundService: {
                notificationTitle: "OfficeOrbit is active",
                notificationBody: "Monitoring location for auto-attendance.",
            }
        });
    } catch (error) {
        console.error('Error starting background location:', error);
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
