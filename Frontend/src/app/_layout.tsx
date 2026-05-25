import { useFonts } from 'expo-font';
import { Stack, useSegments, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform, AppState } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../store/AuthContext';
import useEntitlements from '../hooks/useEntitlements';
import { theme } from '../theme/theme';
import { TransitionOverlay } from '../components/common/TransitionOverlay';
import { ToastProvider } from '../components/common/Toast';
import { AppDialog } from '../components/common/AppDialog';
import '../services/BackgroundTasks';
import {
  registerGeofence,
  stopGeofence,
  unregisterLegacyTasks,
  startLiveProcessWatcher,
  stopLiveProcessWatcher,
} from '../services/LocationService';
import {
  attachNotificationNavigation,
  configureNotificationChannels,
  requestNotificationPermissions,
} from '../services/NotificationService';
import { flushOfflineQueue } from '../services/AttendanceService';
import { handleGeofenceEnter, handleGeofenceExit } from '../services/AttendanceAutomation';

export default function RootLayout() {
  const [loaded, error] = useFonts({});

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      unregisterLegacyTasks(); // Clean up ghost tasks from previous versions
    }
  }, [loaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ToastProvider>
          <RootLayoutNav />
        </ToastProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}



// Auth-gated navigation — production-grade like Flipkart/Amazon
function RootLayoutNav() {
  const { session, loading, profileLoading, isProfileComplete, profile } = useAuth();
  const { capabilities } = useEntitlements();
  const segments = useSegments();
  const hasNavigated = useRef(false);
  const prevSessionRef = useRef<typeof session>(undefined as any);
  const geofenceRegisteredRef = useRef<string | null>(null); // tracks registered user+coords

  useEffect(() => {
    void configureNotificationChannels();

    return attachNotificationNavigation((route, params) => {
      router.replace({
        pathname: route as any,
        params: params ?? {},
      } as any);
    });
  }, []);


  // Synchronize location tracking (Auto -> OS Geofencing; Free/Pro -> JS Process Watcher)
  useEffect(() => {
    let cancelled = false;

    const syncTrackingService = async () => {
      if (!session || !isProfileComplete || !profile?.company_location) return;

      const { latitude, longitude } = profile.company_location;
      const coordKey = `${latitude},${longitude}`;

      if (capabilities.background_automation_level === 'expo_background') {
        // ── Auto Tier: Start native persistent geofencing, turn off JS watcher ──
        stopLiveProcessWatcher();

        if (geofenceRegisteredRef.current === coordKey) return;

        const registered = await registerGeofence(latitude, longitude);
        if (!cancelled && registered) {
          geofenceRegisteredRef.current = coordKey;
        }
      } else {
        // ── Free / Pro Tiers: Start JS process watcher, turn off native geofencing ──
        geofenceRegisteredRef.current = null;
        await stopGeofence();

        if (!cancelled) {
          await startLiveProcessWatcher(
            latitude,
            longitude,
            () => handleGeofenceEnter(),
            () => handleGeofenceExit()
          );
        }
      }
    };

    if (session && isProfileComplete && profile?.company_location) {
      void syncTrackingService();

      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          void syncTrackingService();
          void flushOfflineQueue();
        }
      });

      // Request device notification permission once per session
      requestNotificationPermissions();

      // Flush any offline-queued attendance actions
      void flushOfflineQueue();

      return () => {
        cancelled = true;
        subscription.remove();
        stopLiveProcessWatcher();
      };
    } else {
      geofenceRegisteredRef.current = null;
      void stopGeofence();
      stopLiveProcessWatcher();
    }

    return () => {
      cancelled = true;
      stopLiveProcessWatcher();
    };
  }, [
    session,
    isProfileComplete,
    profile?.company_location?.latitude,
    profile?.company_location?.longitude,
    capabilities.background_automation_level,
  ]);


  const currentRoute = (segments[0] as string) || 'index';
  const authRoutes = ['signin', 'signup', 'verify-otp', 'auth-callback'];
  const isAuthRoute = authRoutes.includes(currentRoute);
  const publicRoutes = ['index', ...authRoutes];
  const isPublicRoute = publicRoutes.includes(currentRoute);

  useEffect(() => {
    if (loading) return;

    const wasLoggedIn = !!prevSessionRef.current;
    const isLoggedIn = !!session;
    prevSessionRef.current = session;

    // Detect auth transition — fresh start like big-tech apps
    const justLoggedOut = wasLoggedIn && !isLoggedIn;

    if (!session) {
      // ── NOT LOGGED IN ──
      // On logout or if on a protected route, redirect to landing
      if (justLoggedOut || (!isPublicRoute && currentRoute !== 'onboarding')) {
        router.replace('/' as any);
      }
    } else {
      // ── LOGGED IN ──
      if (profileLoading) return; // Wait for profile to load first

      if (!isProfileComplete) {
        // Profile incomplete → Force onboarding
        if (currentRoute !== 'onboarding') {
          router.replace('/onboarding' as any);
        }
      } else {
        // Profile complete → Production experience
        if (isAuthRoute || currentRoute === 'index' || currentRoute === 'onboarding') {
          router.replace('/dashboard' as any);
        }
      }
    }
  }, [session, loading, profileLoading, isProfileComplete, segments]);

  // ── Android hardware back button ─────────────────────────────────────────
  // MNC routing patterns:
  //   Dashboard (home tab) → show branded exit dialog (Instagram/Slack pattern)
  //   Other tabs           → silently jump to Dashboard (no stack trace-back)
  //   Auth/onboarding      → let the OS handle it
  const [showExitDialog, setShowExitDialog] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const currentRoute = (segments[0] as string) || 'index';
    const tabRoutes = ['dashboard', 'attendance', 'subscription', 'profile', 'team'];

    if (!session || !tabRoutes.includes(currentRoute)) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentRoute === 'dashboard') {
        // Home tab: show branded exit confirmation (never silently exit)
        setShowExitDialog(true);
        return true; // prevent default
      }
      // Other tabs: jump to home without adding to history
      router.replace('/dashboard' as any);
      return true;
    });

    return () => backHandler.remove();
  }, [session, segments]);

    // Determine if we should show the overlay
    // 1. Initial loading
    // 2. Profile loading
    // 3. User is logged in but still on an auth screen (redirecting...)
    const shouldShowOverlay = 
      loading || 
      profileLoading;

    if (loading) {
        return (
          <TransitionOverlay 
            message="Initializing Orbit..." 
            subMessage="Preparing your workspace" 
          />
        );
    }

    return (
        <>
            <Stack screenOptions={{ animation: 'fade', headerShown: false }}>
                <Stack.Screen name="index"         options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="signin"        options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="signup"        options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="verify-otp"    options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="auth-callback" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="onboarding"    options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="dashboard"     options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="attendance"    options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="subscription"  options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="profile"       options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="team"          options={{ headerShown: false, gestureEnabled: false }} />
            </Stack>

            {/* Exit app confirmation dialog (Android back on Dashboard) */}
            <AppDialog
                visible={showExitDialog}
                icon="log-out-outline"
                iconColor="#EF4444"
                title="Exit OfficeOrbit?"
                message="Your geofence attendance tracking will continue running in the background."
                confirmLabel="Exit"
                cancelLabel="Stay"
                confirmDestructive
                onConfirm={() => {
                    setShowExitDialog(false);
                    BackHandler.exitApp();
                }}
                onCancel={() => setShowExitDialog(false)}
            />

            {/* Global Transition Overlay */}
            {shouldShowOverlay && (
              <TransitionOverlay
                message="Loading Profile..."
                subMessage="Setting up your workspace"
              />
            )}
        </>
    );
}
