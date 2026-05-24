import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import useEntitlements from '../../hooks/useEntitlements';
import { theme } from '../../theme/theme';

let InterstitialAd: any = null;
let AdEventType: any = null;
try {
  const AdMob = require('react-native-google-mobile-ads');
  InterstitialAd = AdMob.InterstitialAd;
  AdEventType = AdMob.AdEventType;
} catch (e) {
  // Safe fallback if not installed or inside Expo Go
}

interface AdInterstitialProps {
  visible: boolean;
  onClose: () => void;
}

const INTERSTITIAL_AD_UNIT = Platform.select({
  android: 'ca-app-pub-4273361282230701/2111145286',
  ios: 'ca-app-pub-4273361282230701/2111145286', // Fallback or iOS unit ID if generated
});

const INTERSTITIAL_ADS = [
  {
    title: 'Unlock Orbit Pro Lifetime 🚀',
    subtitle: 'Say Goodbye to Ads Forever',
    description: 'Tired of seeing ads at every checkout and status update? Get lifetime ad-free access, unlimited historical logs, and enhanced reminders for a single payment of ₹199!',
    cta: 'Upgrade to Pro Lifetime',
  },
  {
    title: 'Set-and-Forget with Auto Tier 🤖',
    subtitle: 'Zero Manual Swipes Ever Again',
    description: 'Get all Pro features plus fully-automated background geofence calibration. Walk into your office and let OfficeOrbit handle the rest in your pocket.',
    cta: 'Unlock Auto Lifetime',
  }
];

export const AdInterstitial: React.FC<AdInterstitialProps> = ({ visible, onClose }) => {
  const { capabilities } = useEntitlements();
  const [countdown, setCountdown] = useState(3);
  const [adIndex, setAdIndex] = useState(0);
  const [isUsingRealAd, setIsUsingRealAd] = useState(false);

  useEffect(() => {
    if (visible && capabilities.ads_enabled && InterstitialAd && !__DEV__) {
      setIsUsingRealAd(true);
      try {
        const unitId = INTERSTITIAL_AD_UNIT;
        if (unitId) {
          const interstitial = InterstitialAd.createForAdRequest(unitId);
          
          const loadListener = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            interstitial.show();
          });
          
          const closeListener = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            setIsUsingRealAd(false);
            onClose();
          });
          
          const errorListener = interstitial.addAdEventListener(AdEventType.ERROR, () => {
            setIsUsingRealAd(false);
            onClose();
          });
          
          interstitial.load();
          
          return () => {
            loadListener();
            closeListener();
            errorListener();
          };
        }
      } catch (e) {
        setIsUsingRealAd(false);
      }
    } else {
      setIsUsingRealAd(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !isUsingRealAd) {
      setCountdown(3);
      setAdIndex((prev) => (prev + 1) % INTERSTITIAL_ADS.length);
    }
  }, [visible, isUsingRealAd]);

  useEffect(() => {
    if (!visible || countdown <= 0 || isUsingRealAd) return;

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [visible, countdown, isUsingRealAd]);

  if (!capabilities.ads_enabled || !visible || isUsingRealAd) {
    return null;
  }

  const currentAd = INTERSTITIAL_ADS[adIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#F5F8FF', '#EBEFFF']}
          style={styles.container}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Top Header */}
          <View style={styles.header}>
            <View style={styles.sponsoredBadge}>
              <Text style={styles.sponsoredText}>SPONSORED AD</Text>
            </View>
            
            <TouchableOpacity
              disabled={countdown > 0}
              onPress={onClose}
              style={[styles.closeBtn, countdown > 0 && styles.closeBtnDisabled]}
            >
              {countdown > 0 ? (
                <Text style={styles.countdownText}>Close in {countdown}s</Text>
              ) : (
                <Ionicons name="close-circle" size={28} color={theme.colors.text.secondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Ad Content */}
          <View style={styles.body}>
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={adIndex === 0 ? 'sparkles-sharp' : 'rocket-sharp'} 
                size={40} 
                color={adIndex === 0 ? '#5B4DFF' : '#FF5252'} 
              />
            </View>
            <Text style={styles.subtitle}>{currentAd.subtitle}</Text>
            <Text style={styles.title}>{currentAd.title}</Text>
            <Text style={styles.description}>{currentAd.description}</Text>
          </View>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.ctaButton}>
              <LinearGradient
                colors={adIndex === 0 ? ['#5B4DFF', '#7B6FFF'] : ['#FF5252', '#FF7F7F']}
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>{currentAd.cta}</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" style={styles.ctaIcon} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.smallText}>Tapping close or action will dismiss this ad</Text>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', // Sleek translucent dark backdrop
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    height: '75%',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    shadowColor: '#5B4DFF',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(91, 77, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sponsoredText: {
    color: '#5B4DFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    alignItems: 'center',
    marginVertical: 20,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  subtitle: {
    color: '#5B4DFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  ctaButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  ctaIcon: {
    marginLeft: 4,
  },
  smallText: {
    color: '#94A3B8',
    fontSize: 11,
  },
});
