import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import useEntitlements from '../../hooks/useEntitlements';
import { theme } from '../../theme/theme';

let BannerAd: any = null;
let BannerAdSize: any = null;
try {
  const AdMob = require('react-native-google-mobile-ads');
  BannerAd = AdMob.BannerAd;
  BannerAdSize = AdMob.BannerAdSize;
} catch (e) {
  // Safe fallback if not installed or inside Expo Go
}

interface AdSlotProps {
  onUpgradePress: () => void;
  screen?: 'dashboard' | 'calendar';
}

const DASHBOARD_AD_UNIT = Platform.select({
  android: 'ca-app-pub-4273361282230701/7363471966',
  ios: 'ca-app-pub-4273361282230701/7363471966',
});

const CALENDAR_AD_UNIT = Platform.select({
  android: 'ca-app-pub-4273361282230701/7060219639',
  ios: 'ca-app-pub-4273361282230701/7060219639',
});

const MOCK_ADS = [
  {
    title: 'Orbit Pro Lifetime 🚀',
    description: 'Get lifetime access with zero ads, deep-history logs, and smarter reminders for just ₹199!',
    cta: 'Go Ad-Free',
  },
  {
    title: 'Never Forget to Check Out ⏰',
    description: 'Enhance your workplace compliance with automatic exit detection and premium recovery reminders.',
    cta: 'Unlock Pro',
  },
  {
    title: 'Go Automatic with Auto Tier 🤖',
    description: 'Run background location geofencing with high-reliability triggers. Never swipe to clock-in again.',
    cta: 'See Auto Plan',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AdSlot: React.FC<AdSlotProps> = ({ onUpgradePress, screen = 'dashboard' }) => {
  const { capabilities } = useEntitlements();
  const [adIndex, setAdIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Rotate ads every 15 seconds with a smooth fade transition
  useEffect(() => {
    if (!capabilities.ads_enabled) return;

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setAdIndex((prev) => (prev + 1) % MOCK_ADS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [capabilities.ads_enabled]);

  // ── Gate 1: Pro / Auto users — return null, zero pixels, zero padding ──
  if (!capabilities.ads_enabled) {
    return null;
  }

  // ── Gate 2: Dev Custom Client or Production Release — render real Google AdMob banner ──
  if (BannerAd && BannerAdSize) {
    const isTest = __DEV__;
    const unitId = isTest
      ? Platform.select({
          android: 'ca-app-pub-3940256099942544/6300978111', // Google Test Banner ID (Android)
          ios: 'ca-app-pub-3940256099942544/2934735716',     // Google Test Banner ID (iOS)
        })
      : (screen === 'calendar' ? CALENDAR_AD_UNIT : DASHBOARD_AD_UNIT);

    if (unitId) {
      return (
        <View style={styles.outerContainer}>
          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <BannerAd
              unitId={unitId}
              size={BannerAdSize.BANNER}
            />
          </View>
        </View>
      );
    }
  }

  const currentAd = MOCK_ADS[adIndex];

  // Dashboard's scrollContent already has padding:16 on all sides.
  // Calendar's ScrollView has no horizontal padding — so we apply it here.
  const isCalendar = screen === 'calendar';

  // ── Dev / Preview: Rich full card — same layout on both Dashboard and Calendar ──
  return (
    <View style={[styles.outerContainer, isCalendar && styles.outerContainerCalendar]}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['rgba(91, 77, 255, 0.08)', 'rgba(123, 111, 255, 0.03)']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.sponsoredBadge}>
              <Text style={styles.sponsoredText}>SPONSORED</Text>
            </View>
            <TouchableOpacity onPress={onUpgradePress} style={styles.closeBtn}>
              <Ionicons name="close-circle-outline" size={18} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Ad Content */}
          <View style={styles.adBody}>
            <Text style={styles.adTitle}>{currentAd.title}</Text>
            <Text style={styles.adDesc}>{currentAd.description}</Text>
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.smallPromoText} numberOfLines={1}>
              Support OfficeOrbit • Zero Ads with Pro
            </Text>
            <TouchableOpacity onPress={onUpgradePress} style={styles.ctaButton}>
              <Text style={styles.ctaText}>{currentAd.cta}</Text>
              <Ionicons name="arrow-forward-outline" size={14} color="#FFF" style={styles.ctaIcon} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Adapts to device screen width automatically via flex layout
  outerContainer: {
    width: '100%',
    // No paddingHorizontal here — Dashboard's scrollContent already has padding:16.
    // Adding it here caused double-inset (square/shrunken look) on the Dashboard.
    marginVertical: theme.spacing.m,
    // Cap width on tablets and larger screens for visual balance
    maxWidth: Math.min(SCREEN_WIDTH, 600),
    alignSelf: 'center',
  },
  // Calendar screen's ScrollView has no horizontal padding, so we add it here.
  outerContainerCalendar: {
    paddingHorizontal: 20,
  },
  container: {
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(91, 77, 255, 0.15)',
    overflow: 'hidden',
    backgroundColor: '#FFF',
    shadowColor: '#5B4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  gradient: {
    padding: theme.spacing.m,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(91, 77, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sponsoredText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 2,
  },
  adBody: {
    marginBottom: theme.spacing.m,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1D20',
    marginBottom: 4,
  },
  adDesc: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: theme.spacing.s,
    gap: 8,
  },
  smallPromoText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    flex: 1,
  },
  ctaButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  ctaIcon: {
    marginLeft: 4,
  },
});
