import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router, usePathname } from 'expo-router';

export default function NotFoundScreen() {
  const pathname = usePathname();

  useEffect(() => {
    // If coming from auth callback, redirect to auth-callback screen
    if (pathname.includes('auth') || pathname.includes('callback')) {
      router.replace('/auth-callback');
    } else {
      // For other unknown routes, go to home
      router.replace('/');
    }
  }, [pathname]);

  // Show invisible/minimal loading instead of error message
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#5B4DFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F7FF',
  },
});
