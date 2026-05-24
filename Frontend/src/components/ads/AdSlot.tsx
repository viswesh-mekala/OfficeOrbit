import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Platform } from 'react-native';
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
  ios: 'ca-app-pub-4273361282230701/7363471966', // Fallback or iOS unit ID if generated
});

const CALENDAR_AD_UNIT = Platform.select({
  android: 'ca-app-pub-4273361282230701/7060219639',
  ios: 'ca-app-pub-4273361282230701/7060219639', // Fallback or iOS unit ID if generated
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

export const AdSlot: React.FC<AdSlotProps> = ({ onUpgradePress, screen = 'dashboard' }) => {
  const { capabilities } = useEntitlements();
  const [adIndex, setAdIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Rotate ads every 15 seconds to make the interface feel alive
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

  // If ads are disabled, collapse entirely and render nothing
  if (!capabilities.ads_enabled) {
    return null;
  }

  // Render direct production Google AdMob ad if BannerAd exists and NOT in local __DEV__ mode
  if (BannerAd && BannerAdSize && !__DEV__) {
    const unitId = screen === 'calendar' ? CALENDAR_AD_UNIT : DASHBOARD_AD_UNIT;
    if (unitId) {
      return (
        <View style={styles.outerContainer}>
          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <BannerAd
              unitId={unitId}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            />
          </View>
        </View>
      );
    }
  }

  const currentAd = MOCK_ADS[adIndex];

  return (
    <View style={styles.outerContainer}>
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
            <Text style={styles.smallPromoText}>Support OfficeOrbit • Zero Ads with Pro</Text>
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
  outerContainer: {
    width: '100%',
    paddingHorizontal: theme.spacing.m,
    marginVertical: theme.spacing.m,
  },
  container: {
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: 'rgba(91, 77, 255, 0.15)',
    overflow: 'hidden',
    backgroundColor: '#FFF',
    shadowColor: '#5B4DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
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
  },
  smallPromoText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
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
