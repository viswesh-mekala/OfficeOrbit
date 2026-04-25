import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Alert } from 'react-native';
import { GEOFENCE_TASK } from './BackgroundTasks';

export const requestPermissions = async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to enable auto-attendance.');
        return false;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
        Alert.alert('Background Permission Required', 'Select "Allow all the time" for automatic check-in.');
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
            console.log('Background task already running');
            return;
        }

        await Location.startLocationUpdatesAsync(GEOFENCE_TASK, {
            accuracy: Location.Accuracy.Balanced, // Balanced for battery (approx 100m)
            distanceInterval: 100, // Update every 100 meters
            deferredUpdatesInterval: 15 * 60 * 1000, // Minimum 15 minutes between updates (Android)
            deferredUpdatesDistance: 100, // Minimum 100 meters
            foregroundService: {
                notificationTitle: "OfficeOrbit is active",
                notificationBody: "Monitoring location for auto-attendance.",
            }
        });
        console.log('Background location tracking started');
    } catch (error) {
        console.error('Error starting background location:', error);
    }
};

export const stopBackgroundUpdate = async () => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
        if (isRegistered) {
            await Location.stopLocationUpdatesAsync(GEOFENCE_TASK);
            console.log('Background location tracking stopped');
        }
    } catch (error) {
        console.error('Error stopping background location:', error);
    }
};
