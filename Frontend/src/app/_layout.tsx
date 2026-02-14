import { useFonts } from 'expo-font';
import { Stack, useSegments, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({});

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, [loaded]);

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

// Auth-gated navigation — production-grade like Flipkart/Amazon
function RootLayoutNav() {
  const { session, loading, profileLoading, isProfileComplete } = useAuth();
  const segments = useSegments();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (loading) return;

    const currentRoute = (segments[0] as string) || 'index';

    // Auth-related routes (user shouldn't be here after login)
    const authRoutes = ['signin', 'signup', 'verify-otp', 'auth-callback'];
    const isAuthRoute = authRoutes.includes(currentRoute);

    // All public routes — no auth needed
    const publicRoutes = ['index', ...authRoutes];
    const isPublicRoute = publicRoutes.includes(currentRoute);

    if (!session) {
      // ── NOT LOGGED IN ──
      // Allow landing, signin, signup, verify-otp, auth-callback
      // Redirect away from all protected routes
      if (!isPublicRoute && currentRoute !== 'onboarding') {
        router.replace('/' as any);
      }
    } else {
      // ── LOGGED IN ──
      if (profileLoading) return; // Wait for profile to load first

      if (!isProfileComplete) {
        // Profile incomplete → Force onboarding
        // Redirect from ANY page except onboarding itself
        if (currentRoute !== 'onboarding') {
          router.replace('/onboarding' as any);
        }
      } else {
        // Profile complete → Production experience
        // Redirect away from auth routes AND landing page
        if (isAuthRoute || currentRoute === 'index' || currentRoute === 'onboarding') {
          router.replace('/dashboard' as any);
        }
      }
    }
  }, [session, loading, profileLoading, isProfileComplete, segments]);

  // Block Android hardware back button on protected screens after login
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const currentRoute = (segments[0] as string) || 'index';
    const blockBackOn = ['dashboard', 'onboarding', 'attendance', 'profile', 'team'];

    if (session && blockBackOn.includes(currentRoute)) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // If on dashboard, exit the app (default behavior)
        // If on other tabs, go to dashboard
        if (currentRoute === 'dashboard') {
          return false; // Let Android handle it (minimize app)
        }
        router.replace('/dashboard' as any);
        return true; // Prevent default back
      });
      return () => backHandler.remove();
    }
  }, [session, segments]);

  // Show loading splash only during initial auth check
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ animation: 'fade', headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="signin" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="verify-otp" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="attendance" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="team" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
