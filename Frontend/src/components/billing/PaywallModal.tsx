import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import useEntitlements from '../../hooks/useEntitlements';
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from '../../services/billing/EntitlementsService';
import { theme } from '../../theme/theme';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose }) => {
  const { planCode, refreshEntitlements } = useEntitlements();
  const [loading, setLoading] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [purchasedPlan, setPurchasedPlan] = useState('');

  const getProButtonText = () => {
    if (planCode === 'pro_lifetime') return '✓ Active Entitlement';
    if (planCode === 'auto_lifetime') return 'Included in Auto Lifetime';
    return 'Unlock Pro Lifetime';
  };

  const isProButtonDisabled = loading || planCode === 'pro_lifetime' || planCode === 'auto_lifetime';

  const getAutoButtonText = () => {
    if (planCode === 'auto_lifetime') return '✓ Active Entitlement';
    if (planCode === 'pro_lifetime') return 'Upgrade to Auto Lifetime';
    return 'Unlock Auto Lifetime';
  };

  const isAutoButtonDisabled = loading || planCode === 'auto_lifetime';

  const triggerHaptic = (type: Haptics.NotificationFeedbackType) => {
    try {
      void Haptics.notificationAsync(type);
    } catch (_e) {
      // Ignored if haptics fail or not supported on this device/emulator
    }
  };

  const handlePurchase = async (plan: 'pro_lifetime' | 'auto_lifetime') => {
    if (planCode === plan) {
      Alert.alert('Already Owned', 'You already own this lifetime entitlement!');
      return;
    }

    setLoading(true);
    triggerHaptic(Haptics.NotificationFeedbackType.Success);

    try {
      // 1. Create order (automatically detects keys or runs in developer sandbox mode)
      const orderRes = await createSubscriptionOrder(plan);
      if (orderRes.error || !orderRes.data) {
        throw new Error(orderRes.error || 'Failed to initialize checkout');
      }

      const orderData = orderRes.data;

      // 2. Perform payment logic.
      // Since standard Expo Go doesn't support native Razorpay, we execute the checkout using
      // our robust Edge Function Verify. In Sandbox mode, we automatically simulate the Razorpay transaction payload.
      if (orderData.is_sandbox) {
        // Simulate a tiny delay for payment gateway processing
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const verifyRes = await verifySubscriptionPayment({
          razorpay_order_id: orderData.id,
          razorpay_payment_id: `pay_sandbox_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
          plan_code: plan,
        });

        if (verifyRes.error || !verifyRes.data) {
          throw new Error(verifyRes.error || 'Signature verification failed');
        }

        // Trigger premium celebration
        setPurchasedPlan(plan === 'pro_lifetime' ? 'Orbit Pro Lifetime' : 'Orbit Auto Lifetime');
        setSuccessMode(true);
        triggerHaptic(Haptics.NotificationFeedbackType.Success);
        await refreshEntitlements();
      } else {
        // Real Razorpay integration placeholder (triggered when keys are present in Supabase edge functions)
        Alert.alert(
          'Production Billing',
          'Production builds will compile custom EAS clients integrating razorpay-sdk. In this preview sandbox, mock controls are enabled below!'
        );
      }
    } catch (err: any) {
      triggerHaptic(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Checkout Failed', err.message || 'Could not complete subscription');
    } finally {
      setLoading(false);
    }
  };

  const renderSuccessView = () => (
    <LinearGradient colors={['#101217', '#1A1D24']} style={styles.successBg}>
      <View style={styles.successWrapper}>
        <View style={styles.successIconCircle}>
          <Ionicons name="sparkles" size={56} color="#FFD700" />
        </View>
        <Text style={styles.successTitle}>WELCOME IN ORBIT! 🚀</Text>
        <Text style={styles.successSubtitle}>
          You have successfully upgraded your account to{' '}
          <Text style={styles.highlightText}>{purchasedPlan}</Text>.
        </Text>
        <Text style={styles.successDesc}>
          All premium capabilities have been instantly unlocked on your account! Enjoy ad-free logs
          and advanced tracking reliability.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setSuccessMode(false);
            onClose();
          }}
          style={styles.successButton}
        >
          <Text style={styles.successButtonText}>Launch into Orbit 🛸</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={() => {
        if (!loading && !successMode) onClose();
      }}
    >
      {successMode ? (
        renderSuccessView()
      ) : (
        <LinearGradient colors={['#0F1115', '#161920']} style={styles.container}>
          {/* Close button */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>OfficeOrbit Premium</Text>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Top Pitch */}
            <View style={styles.pitchSection}>
              <Text style={styles.pitchText}>Select Your Professional Plan</Text>
              <Text style={styles.pitchSub}>Upgrade to eliminate manual errors and track attendance effortlessly.</Text>
            </View>

            {/* Plan 1: Free */}
            <View style={[styles.planCard, planCode === 'free' && styles.activeBorderFree]}>
              <LinearGradient colors={['#172B24', '#101F1A']} style={styles.planGradient}>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>Smart Free</Text>
                    <Text style={styles.planSub}>Essential Manual Attendance</Text>
                  </View>
                  <Text style={styles.planPrice}>₹0</Text>
                </View>
                <View style={styles.features}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.featureText}>Manual swipe clock-in/out</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.featureText}>30-Day history tracking</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="alert-circle-outline" size={16} color="#FF9800" />
                    <Text style={styles.featureText}>Includes standard banner ads</Text>
                  </View>
                </View>
                <View style={styles.activeLabel}>
                  {planCode === 'free' && (
                    <Text style={styles.activeTextFree}>✓ YOUR ACTIVE TIER</Text>
                  )}
                </View>
              </LinearGradient>
            </View>

            {/* Plan 2: Pro Lifetime */}
            <View style={[styles.planCard, planCode === 'pro_lifetime' && styles.activeBorderPro]}>
              <LinearGradient colors={['#16233B', '#0F1A2D']} style={styles.planGradient}>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planNamePro}>Pro Lifetime 👑</Text>
                    <Text style={styles.planSub}>Ad-Free & Unlimited History</Text>
                  </View>
                  <Text style={styles.planPrice}>₹199</Text>
                </View>
                <View style={styles.features}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#5B4DFF" />
                    <Text style={styles.featureText}>No Ads Forever</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#5B4DFF" />
                    <Text style={styles.featureText}>Unlimited History Archive</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#5B4DFF" />
                    <Text style={styles.featureText}>Enhanced custom reminders</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.proButton,
                    isProButtonDisabled && styles.disabledButton,
                  ]}
                  onPress={() => handlePurchase('pro_lifetime')}
                  disabled={isProButtonDisabled}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text
                      style={[
                        styles.buttonText,
                        isProButtonDisabled && styles.disabledButtonText,
                      ]}
                    >
                      {getProButtonText()}
                    </Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Plan 3: Auto Lifetime */}
            <View style={[styles.planCard, planCode === 'auto_lifetime' && styles.activeBorderAuto]}>
              <LinearGradient colors={['#2D1E20', '#201516']} style={styles.planGradient}>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planNameAuto}>Auto Lifetime 🚀</Text>
                    <Text style={styles.planSub}>High-Reliability Automation</Text>
                  </View>
                  <Text style={styles.planPrice}>₹499</Text>
                </View>
                <View style={styles.features}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#FF5252" />
                    <Text style={styles.featureText}>Everything in Pro Tier</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#FF5252" />
                    <Text style={styles.featureText}>Advanced background geofencing</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#FF5252" />
                    <Text style={styles.featureText}>Exit-polling & auto checkout recovery</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.autoButton,
                    isAutoButtonDisabled && styles.disabledButton,
                  ]}
                  onPress={() => handlePurchase('auto_lifetime')}
                  disabled={isAutoButtonDisabled}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text
                      style={[
                        styles.buttonText,
                        isAutoButtonDisabled && styles.disabledButtonText,
                      ]}
                    >
                      {getAutoButtonText()}
                    </Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Terms and Info */}
            <Text style={styles.disclaimer}>
              All paid upgrades are one-time payments for lifetime accounts. Geofencing accuracy depends on background location permissions, system battery settings, and device hardware.
            </Text>
          </ScrollView>
        </LinearGradient>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingTop: 50,
    paddingBottom: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  scrollContent: {
    padding: theme.spacing.m,
    paddingBottom: 40,
  },
  pitchSection: {
    alignItems: 'center',
    marginVertical: theme.spacing.m,
  },
  pitchText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  pitchSub: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    paddingHorizontal: theme.spacing.m,
    lineHeight: 20,
  },
  planCard: {
    borderRadius: theme.borderRadius.m,
    overflow: 'hidden',
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeBorderFree: {
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  activeBorderPro: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  activeBorderAuto: {
    borderColor: '#FF5252',
    shadowColor: '#FF5252',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  planGradient: {
    padding: theme.spacing.m,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.m,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  planNamePro: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7B6FFF',
  },
  planNameAuto: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF5252',
  },
  planSub: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 2,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  features: {
    marginBottom: theme.spacing.m,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: '#EEE',
    fontSize: 13,
    marginLeft: 8,
  },
  proButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.s,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  autoButton: {
    backgroundColor: '#FF5252',
    borderRadius: theme.borderRadius.s,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.25)',
  },
  activeLabel: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeTextFree: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },
  disclaimer: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: theme.spacing.s,
    paddingHorizontal: theme.spacing.s,
  },
  // Success states
  successBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successWrapper: {
    width: '90%',
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.l,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1.5,
    marginBottom: theme.spacing.s,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#DDD',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.m,
  },
  highlightText: {
    fontWeight: '700',
    color: '#FFD700',
  },
  successDesc: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.s,
  },
  successButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.m,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  successButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
});
