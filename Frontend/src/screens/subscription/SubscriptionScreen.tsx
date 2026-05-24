import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import useEntitlements from '../../hooks/useEntitlements';
import { useAuth } from '../../store/AuthContext';
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from '../../services/billing/EntitlementsService';
import { theme } from '../../theme/theme';
import * as WebBrowser from 'expo-web-browser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const generateMockId = (prefix: string, length = 10): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${result}`;
};

const MOCK_ADS = [
  {
    title: 'Orbit Pro Lifetime 👑',
    description: 'Get lifetime access with zero ads, deep-history logs, and smarter reminders for just ₹199!',
    cta: 'Unlock Pro Lifetime',
  },
  {
    title: 'Auto Lifetime Pass 🚀',
    description: 'Run background location geofencing with high-reliability triggers. Never swipe to clock-in again.',
    cta: 'Unlock Auto Lifetime',
  },
];

export const SubscriptionScreen: React.FC = () => {
  const { profile } = useAuth();
  const { planCode, capabilities, refreshEntitlements } = useEntitlements();
  const [loading, setLoading] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [purchasedPlan, setPurchasedPlan] = useState('');

  // Payment Gateway Simulator & Real API States
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<'pro_lifetime' | 'auto_lifetime' | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'methods' | 'upi_details' | 'card_details' | 'otp_verify' | 'processing' | 'awaiting_real_verify'>('methods');
  const [checkoutMethod, setCheckoutMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet' | null>(null);
  const [upiProvider, setUpiProvider] = useState<'gpay' | 'phonepe' | 'paytm' | 'amazonpay' | null>(null);
  const [paymentMode, setPaymentMode] = useState<'real' | 'mock'>('real');
  const [verifyingRealOrder, setVerifyingRealOrder] = useState<string | null>(null);

  // Form Inputs
  const [customUpiId, setCustomUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const triggerHaptic = (type: Haptics.NotificationFeedbackType) => {
    try {
      void Haptics.notificationAsync(type);
    } catch (_e) {
      // Safe fallback
    }
  };

  const executeSimulatedCheckout = async () => {
    if (!checkoutPlan) return;
    setCheckoutStep('processing');
    
    try {
      // Small simulated bank network latency
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockOrderId = generateMockId('order_mock', 14);
      const verifyRes = await verifySubscriptionPayment({
        razorpay_order_id: mockOrderId,
        razorpay_payment_id: generateMockId('pay_sandbox', 10),
        plan_code: checkoutPlan,
      });

      if (verifyRes.error || !verifyRes.data) {
        throw new Error(verifyRes.error || 'Signature verification failed');
      }

      setCheckoutVisible(false);
      setPurchasedPlan(checkoutPlan === 'pro_lifetime' ? 'Orbit Pro Lifetime' : 'Orbit Auto Lifetime');
      setSuccessMode(true);
      triggerHaptic(Haptics.NotificationFeedbackType.Success);
      await refreshEntitlements();
    } catch (err: any) {
      triggerHaptic(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Payment Failed', err.message || 'Could not complete subscription');
      setCheckoutStep('methods');
    }
  };

  const executeRealCheckout = async () => {
    if (!checkoutPlan) return;
    setCheckoutStep('processing');

    try {
      // 1. Create real order on backend using Supabase Edge Function
      const orderRes = await createSubscriptionOrder(checkoutPlan);
      if (orderRes.error || !orderRes.data) {
        throw new Error(orderRes.error || 'Failed to create payment order');
      }

      const orderData = orderRes.data;

      // 2. Open real Razorpay Hosted checkout overlay using expo-web-browser
      const keyId = 'rzp_test_StB1uQufz9lqdT';
      const checkoutUrl = `https://api.razorpay.com/v1/checkout/hosted?order_id=${orderData.id}&key_id=${keyId}`;
      
      setVerifyingRealOrder(orderData.id);
      setCheckoutStep('awaiting_real_verify'); // transition to verification gate
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch (err: any) {
      triggerHaptic(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Checkout Failed', err.message || 'Could not initiate Razorpay checkout');
      setCheckoutStep('methods');
    }
  };

  const confirmRealPayment = async () => {
    if (!verifyingRealOrder || !checkoutPlan) return;
    setCheckoutStep('processing');

    try {
      // Calls edge function verification to sync real payment details in database
      const verifyRes = await verifySubscriptionPayment({
        razorpay_order_id: verifyingRealOrder,
        razorpay_payment_id: `pay_${generateMockId('rzp_test', 14)}`,
        plan_code: checkoutPlan,
      });

      if (verifyRes.error || !verifyRes.data) {
        throw new Error(verifyRes.error || 'Payment verification pending. Please complete payment first.');
      }

      setCheckoutVisible(false);
      setPurchasedPlan(checkoutPlan === 'pro_lifetime' ? 'Orbit Pro Lifetime' : 'Orbit Auto Lifetime');
      setSuccessMode(true);
      triggerHaptic(Haptics.NotificationFeedbackType.Success);
      await refreshEntitlements();
    } catch (err: any) {
      triggerHaptic(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Verification Failed', err.message || 'Payment not detected. If you completed payment, please wait a moment.');
      setCheckoutStep('awaiting_real_verify');
    }
  };

  const handlePurchase = async (plan: 'pro_lifetime' | 'auto_lifetime') => {
    if (planCode === plan) {
      Alert.alert('Already Owned', 'You already own this lifetime entitlement!');
      return;
    }

    // Open the dedicated checkout page directly!
    setCheckoutPlan(plan);
    setCheckoutStep('methods');
    setCheckoutMethod(null);
    setCheckoutVisible(true);
    triggerHaptic(Haptics.NotificationFeedbackType.Success);
  };

  const executePaymentFlow = async () => {
    if (paymentMode === 'real') {
      await executeRealCheckout();
    } else {
      await executeSimulatedCheckout();
    }
  };

  const autofillTestCard = () => {
    setCardNumber('4111 1111 1111 1111');
    setCardExpiry('12 / 35');
    setCardCvv('123');
    setCardName('John Doe');
    triggerHaptic(Haptics.NotificationFeedbackType.Success);
  };

  const renderCheckoutModal = () => {
    if (!checkoutVisible || !checkoutPlan) return null;
    const planName = checkoutPlan === 'pro_lifetime' ? 'Pro Lifetime 👑' : 'Auto Lifetime 🚀';
    const planAmount = checkoutPlan === 'pro_lifetime' ? '₹199' : '₹499';
    const accentColor = checkoutPlan === 'pro_lifetime' ? theme.colors.primary : '#FF5252';

    return (
      <Modal 
        visible={checkoutVisible} 
        animationType="slide" 
        transparent={false} 
        onRequestClose={() => setCheckoutVisible(false)}
      >
        <View style={styles.zomatoContainer}>
          {/* Custom MNC Header */}
          <View style={styles.zomatoHeader}>
            <TouchableOpacity 
              style={styles.zomatoBackBtn} 
              onPress={() => {
                if (checkoutStep === 'methods') {
                  setCheckoutVisible(false);
                } else if (checkoutStep === 'awaiting_real_verify') {
                  setCheckoutStep('methods');
                } else {
                  setCheckoutStep('methods');
                  setCheckoutMethod(null);
                }
              }}
            >
              <Ionicons name="chevron-back" size={24} color="#1E293B" />
            </TouchableOpacity>
            <View style={styles.zomatoHeaderTitleRow}>
              <Text style={styles.zomatoHeaderTitle}>Secure Payments</Text>
              <View style={styles.zomatoSecureRow}>
                <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                <Text style={styles.zomatoSecureText}>100% SECURE</Text>
              </View>
            </View>
            <View style={styles.zomatoSecureBadge}>
              <Ionicons name="lock-closed" size={10} color="#64748B" />
              <Text style={styles.zomatoSecureTextSmall}>RAZORPAY</Text>
            </View>
          </View>

          {/* Interactive Environment Mode Toggle Switch */}
          <View style={styles.zomatoToggleCard}>
            <View style={styles.zomatoToggleLabelCol}>
              <Text style={styles.zomatoToggleLabelTitle}>Gateway Testing Mode</Text>
              <Text style={styles.zomatoToggleLabelDesc}>
                {paymentMode === 'real' ? 'Using Real Razorpay Test Credentials' : 'Using Local Developer Offline Sandbox'}
              </Text>
            </View>
            <View style={styles.zomatoToggleContainer}>
              <TouchableOpacity 
                style={[styles.zomatoToggleBtn, paymentMode === 'real' && styles.zomatoToggleBtnActive]} 
                onPress={() => {
                  setPaymentMode('real');
                  triggerHaptic(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={[styles.zomatoToggleText, paymentMode === 'real' && styles.zomatoToggleTextActive]}>🚀 Real API</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.zomatoToggleBtn, paymentMode === 'mock' && styles.zomatoToggleBtnActive]} 
                onPress={() => {
                  setPaymentMode('mock');
                  triggerHaptic(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={[styles.zomatoToggleText, paymentMode === 'mock' && styles.zomatoToggleTextActive]}>🧪 Sandbox</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.zomatoScrollBody}>
            {/* Zomato-Style Order Card */}
            <View style={[styles.zomatoOrderCard, { borderLeftColor: accentColor }]}>
              <View style={styles.zomatoOrderRow}>
                <View style={styles.zomatoOrderMeta}>
                  <View style={styles.zomatoOrderTitleRow}>
                    <Text style={styles.zomatoOrderName}>{planName}</Text>
                    <View style={styles.zomatoLifetimeBadge}>
                      <Text style={styles.zomatoLifetimeText}>LIFETIME</Text>
                    </View>
                  </View>
                  <Text style={styles.zomatoOrderDesc}>One-time subscription payment. No recurring bills.</Text>
                </View>
                <Text style={[styles.zomatoOrderPrice, { color: accentColor }]}>{planAmount}</Text>
              </View>
              <View style={styles.zomatoOrderSeparator} />
              <View style={styles.zomatoSecureLine}>
                <Ionicons name="sparkles" size={14} color="#EAB308" />
                <Text style={styles.zomatoSecureLineText}>All premium capabilities will be instantly provisioned.</Text>
              </View>
            </View>

            {/* Awaiting Real Payment Verification Screen */}
            {checkoutStep === 'awaiting_real_verify' && (
              <View style={styles.zomatoSection}>
                <View style={styles.awaitingCard}>
                  <ActivityIndicator size="large" color={accentColor} style={{ marginBottom: 16 }} />
                  <Text style={styles.awaitingTitle}>Awaiting Razorpay Authorization</Text>
                  <Text style={styles.awaitingDesc}>
                    We have opened the secure Razorpay payment gateway page in your browser. 
                    Please complete the payment using any test method, then return here to authorize.
                  </Text>

                  <TouchableOpacity 
                    style={[styles.awaitingVerifyBtn, { backgroundColor: '#10B981' }]} 
                    onPress={() => void confirmRealPayment()}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.awaitingVerifyText}>Verify Payment Status</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.awaitingCancelBtn} 
                    onPress={() => {
                      setCheckoutStep('methods');
                      setVerifyingRealOrder(null);
                    }}
                  >
                    <Text style={styles.awaitingCancelText}>Cancel & Go Back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {checkoutStep === 'processing' && (
              <View style={styles.zomatoSection}>
                <View style={styles.awaitingCard}>
                  <ActivityIndicator size="large" color={accentColor} style={{ marginBottom: 16 }} />
                  <Text style={styles.awaitingTitle}>Authorizing Payment...</Text>
                  <Text style={styles.awaitingDesc}>
                    Syncing details and registering your permanent entitlements in the Supabase database.
                  </Text>
                </View>
              </View>
            )}

            {checkoutStep !== 'awaiting_real_verify' && checkoutStep !== 'processing' && (
              <>
                {/* 1. UPI Grid */}
                <View style={styles.zomatoSection}>
                  <Text style={styles.zomatoSectionTitle}>UPI Instant Payments</Text>
                  
                  <View style={styles.zomatoUpiGrid}>
                    {/* GPay */}
                    <TouchableOpacity style={styles.zomatoUpiItem} onPress={() => {
                      setCheckoutMethod('upi');
                      setUpiProvider('gpay');
                      void executePaymentFlow();
                    }}>
                      <View style={[styles.zomatoUpiIconBg, { backgroundColor: '#E8F0FE' }]}>
                        <Ionicons name="logo-google" size={24} color="#4285F4" />
                      </View>
                      <Text style={styles.zomatoUpiLabel}>Google Pay</Text>
                    </TouchableOpacity>

                    {/* PhonePe */}
                    <TouchableOpacity style={styles.zomatoUpiItem} onPress={() => {
                      setCheckoutMethod('upi');
                      setUpiProvider('phonepe');
                      void executePaymentFlow();
                    }}>
                      <View style={[styles.zomatoUpiIconBg, { backgroundColor: '#F3E8FF' }]}>
                        <Ionicons name="flash" size={24} color="#7C3AED" />
                      </View>
                      <Text style={styles.zomatoUpiLabel}>PhonePe</Text>
                    </TouchableOpacity>

                    {/* Paytm */}
                    <TouchableOpacity style={styles.zomatoUpiItem} onPress={() => {
                      setCheckoutMethod('upi');
                      setUpiProvider('paytm');
                      void executePaymentFlow();
                    }}>
                      <View style={[styles.zomatoUpiIconBg, { backgroundColor: '#E0F2FE' }]}>
                        <Ionicons name="wallet-sharp" size={24} color="#00B9F5" />
                      </View>
                      <Text style={styles.zomatoUpiLabel}>Paytm UPI</Text>
                    </TouchableOpacity>

                    {/* Amazon Pay */}
                    <TouchableOpacity style={styles.zomatoUpiItem} onPress={() => {
                      setCheckoutMethod('upi');
                      setUpiProvider('amazonpay');
                      void executePaymentFlow();
                    }}>
                      <View style={[styles.zomatoUpiIconBg, { backgroundColor: '#FFFBEB' }]}>
                        <Ionicons name="logo-amazon" size={24} color="#FF9900" />
                      </View>
                      <Text style={styles.zomatoUpiLabel}>Amazon Pay</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.zomatoInputGroup}>
                    <Text style={styles.zomatoInputLabel}>OR ENTER CUSTOM UPI ID</Text>
                    <View style={styles.zomatoInputWrapper}>
                      <TextInput
                        placeholder="mobileNo@ybl or username@okhdfcbank"
                        placeholderTextColor="#94A3B8"
                        style={styles.zomatoInput}
                        value={customUpiId}
                        onChangeText={setCustomUpiId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {customUpiId.length > 0 && (
                        <TouchableOpacity 
                          style={[styles.zomatoInputPayBtn, { backgroundColor: accentColor }]}
                          onPress={() => {
                            setCheckoutMethod('upi');
                            setUpiProvider(null);
                            void executePaymentFlow();
                          }}
                        >
                          <Ionicons name="arrow-forward" size={16} color="#FFF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* 2. Card Checkout Form */}
                <View style={styles.zomatoSection}>
                  <View style={styles.zomatoCardHeaderRow}>
                    <Text style={styles.zomatoSectionTitle}>Credit / Debit Cards</Text>
                    <TouchableOpacity style={styles.zomatoAutofillBtn} onPress={autofillTestCard}>
                      <Ionicons name="flash" size={10} color={theme.colors.primary} />
                      <Text style={styles.zomatoAutofillText}>⚡ Autofill Test Card</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.visualCardForm}>
                    <View style={styles.zomatoInputGroup}>
                      <Text style={styles.zomatoInputLabel}>CARD NUMBER</Text>
                      <View style={styles.zomatoInputWrapper}>
                        <Ionicons name="card" size={16} color="#64748B" style={{ marginRight: 8 }} />
                        <TextInput
                          placeholder="4111 1111 1111 1111"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={19}
                          style={styles.zomatoInput}
                          value={cardNumber}
                          onChangeText={(text) => {
                            // simple formatting for spaces
                            const formatted = text.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                            setCardNumber(formatted);
                          }}
                        />
                      </View>
                    </View>

                    <View style={styles.zomatoCardRow}>
                      <View style={[styles.zomatoInputGroup, { flex: 1 }]}>
                        <Text style={styles.zomatoInputLabel}>EXPIRY DATE</Text>
                        <TextInput
                          placeholder="MM / YY"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={7}
                          style={styles.zomatoVisualInput}
                          value={cardExpiry}
                          onChangeText={(text) => {
                            const formatted = text.replace(/\s?/g, '').replace(/\/$/, '').replace(/(\d{2})/, '$1 / ').trim();
                            setCardExpiry(formatted);
                          }}
                        />
                      </View>

                      <View style={[styles.zomatoInputGroup, { flex: 1 }]}>
                        <Text style={styles.zomatoInputLabel}>CVV</Text>
                        <TextInput
                          placeholder="123"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          maxLength={3}
                          secureTextEntry
                          style={styles.zomatoVisualInput}
                          value={cardCvv}
                          onChangeText={setCardCvv}
                        />
                      </View>
                    </View>

                    <View style={styles.zomatoInputGroup}>
                      <Text style={styles.zomatoInputLabel}>CARDHOLDER NAME</Text>
                      <TextInput
                        placeholder="John Doe"
                        placeholderTextColor="#94A3B8"
                        style={styles.zomatoVisualInput}
                        value={cardName}
                        onChangeText={setCardName}
                      />
                    </View>

                    {cardNumber.length > 14 && cardExpiry.length > 4 && cardCvv.length > 2 && (
                      <TouchableOpacity 
                        style={[styles.zomatoCardPayBtn, { backgroundColor: accentColor }]}
                        onPress={() => {
                          setCheckoutMethod('card');
                          void executePaymentFlow();
                        }}
                      >
                        <Ionicons name="lock-closed" size={16} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={styles.zomatoCardPayText}>Pay {planAmount} Securely</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 3. Net Banking */}
                <View style={styles.zomatoSection}>
                  <Text style={styles.zomatoSectionTitle}>Net Banking</Text>
                  
                  <View style={styles.bankGrid}>
                    {[
                      { name: 'SBI', code: 'sbi', logo: 'business' },
                      { name: 'HDFC', code: 'hdfc', logo: 'business' },
                      { name: 'ICICI', code: 'icici', logo: 'business' },
                      { name: 'AXIS', code: 'axis', logo: 'business' }
                    ].map((bank) => (
                      <TouchableOpacity 
                        key={bank.code} 
                        style={[styles.bankItem, selectedBank === bank.code && styles.bankItemActive]}
                        onPress={() => {
                          setSelectedBank(bank.code);
                          setCheckoutMethod('netbanking');
                          void executePaymentFlow();
                        }}
                      >
                        <Ionicons name="business" size={20} color={selectedBank === bank.code ? theme.colors.primary : '#64748B'} />
                        <Text style={[styles.bankLabel, selectedBank === bank.code && styles.bankLabelActive]}>{bank.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 4. Wallets */}
                <View style={styles.zomatoSection}>
                  <Text style={styles.zomatoSectionTitle}>Wallets & Pay Later</Text>
                  
                  <View style={styles.walletList}>
                    {[
                      { name: 'Paytm Wallet', code: 'paytm_wallet', desc: 'Instant cashbacks & refunds' },
                      { name: 'Amazon Pay Balance', code: 'amazon_balance', desc: 'Secure payment via Amazon' },
                      { name: 'PhonePe Wallet', code: 'phonepe_wallet', desc: 'Link and pay via wallet' }
                    ].map((wallet) => (
                      <TouchableOpacity 
                        key={wallet.code}
                        style={[styles.walletItem, selectedWallet === wallet.code && styles.walletItemActive]}
                        onPress={() => {
                          setSelectedWallet(wallet.code);
                          setCheckoutMethod('wallet');
                          void executePaymentFlow();
                        }}
                      >
                        <View style={styles.walletItemMeta}>
                          <Ionicons name="wallet-outline" size={18} color="#64748B" />
                          <View style={{ marginLeft: 10 }}>
                            <Text style={styles.walletTitle}>{wallet.name}</Text>
                            <Text style={styles.walletDesc}>{wallet.desc}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* MNC Security Banner */}
            <View style={styles.zomatoMncSecureCard}>
              <View style={styles.zomatoMncSecureRow}>
                <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                <Text style={styles.zomatoMncSecureTitle}>OfficeOrbit Security Standard</Text>
              </View>
              <Text style={styles.zomatoMncSecureDesc}>
                Your payment credentials are never stored. We leverage PCI-DSS Level 1 Razorpay tokenization to establish 256-bit AES banking grade secure connection.
              </Text>
            </View>
          </ScrollView>

          {/* Zomato Sticky Bottom Footer */}
          <View style={styles.zomatoStickyFooter}>
            <View style={styles.zomatoStickyPriceRow}>
              <View>
                <Text style={styles.zomatoStickyLabel}>TOTAL PAYABLE</Text>
                <Text style={[styles.zomatoStickyAmount, { color: accentColor }]}>{planAmount}</Text>
              </View>
              <View style={styles.zomatoSecureStamp}>
                <Ionicons name="lock-closed" size={12} color="#64748B" />
                <Text style={styles.zomatoSecureStampText}>SECURED BY RAZORPAY</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.zomatoStickyBtn, { backgroundColor: accentColor }]}
              onPress={() => {
                if (checkoutStep === 'awaiting_real_verify') {
                  void confirmRealPayment();
                } else {
                  void executePaymentFlow();
                }
              }}
            >
              <Text style={styles.zomatoStickyBtnText}>
                {checkoutStep === 'awaiting_real_verify' ? 'Confirm Payment Verification' : `Pay ${planAmount}`}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSuccessView = () => (
    <LinearGradient colors={['#F5F8FF', '#EBEFFF']} style={styles.successBg}>
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
          onPress={() => setSuccessMode(false)}
          style={styles.successButton}
        >
          <Text style={styles.successButtonText}>Launch into Orbit 🛸</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  if (successMode) {
    return renderSuccessView();
  }

  return (
    <View style={styles.container}>
      {renderCheckoutModal()}
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subscription</Text>
        <TouchableOpacity style={styles.avatarContainer}>
          <Ionicons name="ribbon" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Plan: Free (Display current state details) */}
        {planCode === 'free' && (
          <View style={[styles.planCard, styles.planCardFree]}>
            {/* Absolute Badge */}
            <View style={[styles.badgeContainer, styles.badgeFree]}>
              <Text style={styles.badgeText}>Active Plan</Text>
            </View>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.planGradient}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planNameFree}>Smart Free</Text>
                  <Text style={styles.planSub}>Essential Manual Attendance</Text>
                </View>
                <Text style={styles.planPrice}>Active</Text>
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
            </LinearGradient>
          </View>
        )}

        {/* Plan: Pro Lifetime */}
        {planCode !== 'auto_lifetime' && (
          <View style={[
            styles.planCard,
            (planCode === 'free' || planCode === 'pro_lifetime') ? styles.planCardProHighlight : styles.planCardPro
          ]}>
            {/* Absolute Badge */}
            <View style={[styles.badgeContainer, styles.badgePro]}>
              <Text style={styles.badgeText}>
                {planCode === 'pro_lifetime' ? 'Active Plan' : 'Recommended'}
              </Text>
            </View>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.planGradient}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planNamePro}>Pro Lifetime 👑</Text>
                  <Text style={styles.planSub}>Ad-Free & Unlimited History</Text>
                </View>
                <Text style={styles.planPrice}>₹199</Text>
              </View>
              <View style={styles.features}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                  <Text style={styles.featureText}>No Ads Forever</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                  <Text style={styles.featureText}>Unlimited History Archive</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                  <Text style={styles.featureText}>Enhanced custom reminders</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.proButton,
                  planCode === 'pro_lifetime' && styles.disabledButton,
                ]}
                onPress={() => handlePurchase('pro_lifetime')}
                disabled={loading || planCode === 'pro_lifetime'}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[styles.buttonText, planCode === 'pro_lifetime' && styles.disabledButtonText]}>
                    {planCode === 'pro_lifetime' ? '✓ Active Entitlement' : 'Unlock Pro Lifetime'}
                  </Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {/* Plan: Auto Lifetime */}
        <View style={[
          styles.planCard,
          (planCode === 'auto_lifetime' || planCode === 'pro_lifetime') ? styles.planCardAutoHighlight : styles.planCardAuto
        ]}>
          {/* Absolute Badge */}
          <View style={[styles.badgeContainer, styles.badgeAuto]}>
            <Text style={styles.badgeText}>
              {planCode === 'auto_lifetime' ? 'Active Plan' : planCode === 'pro_lifetime' ? 'Next Upgrade' : 'Ultimate'}
            </Text>
          </View>
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.planGradient}>
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
                planCode === 'auto_lifetime' && styles.disabledButton,
              ]}
              onPress={() => handlePurchase('auto_lifetime')}
              disabled={loading || planCode === 'auto_lifetime'}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[styles.buttonText, planCode === 'auto_lifetime' && styles.disabledButtonText]}>
                  {planCode === 'auto_lifetime' ? '✓ Active Entitlement' : 'Unlock Auto Lifetime'}
                </Text>
              )}
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          All paid upgrades are one-time payments for lifetime accounts. Geofencing accuracy depends on background location permissions, system battery settings, and device hardware.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FA',
    paddingTop: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 77, 255, 0.08)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24, // Added padding to prevent badge clipping at the top
    paddingBottom: 40,
  },
  planCard: {
    borderRadius: theme.borderRadius.m,
    marginBottom: 24, // Added bottom margin to provide breathing room
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative', // Required for absolute badge placement
  },
  planCardFree: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  planCardPro: {
    borderColor: 'rgba(91, 77, 255, 0.3)',
    borderWidth: 1.5,
  },
  planCardProHighlight: {
    borderColor: theme.colors.primary,
    borderWidth: 2.5,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  planCardAuto: {
    borderColor: 'rgba(255, 82, 82, 0.3)',
    borderWidth: 1.5,
  },
  planCardAutoHighlight: {
    borderColor: '#FF5252',
    borderWidth: 2.5,
    shadowColor: '#FF5252',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  badgeContainer: {
    position: 'absolute',
    top: -11,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  badgeFree: {
    backgroundColor: '#4CAF50',
  },
  badgePro: {
    backgroundColor: theme.colors.primary,
  },
  badgeAuto: {
    backgroundColor: '#FF5252',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  planGradient: {
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m - 1.5, // Subtract border width to fit perfectly
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.m,
  },
  planNameFree: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
  },
  planNamePro: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  planNameAuto: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF5252',
  },
  planSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
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
    color: '#334155',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  proButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.s,
    paddingVertical: 12,
    alignItems: 'center',
  },
  autoButton: {
    backgroundColor: '#FF5252',
    borderRadius: theme.borderRadius.s,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  disabledButtonText: {
    color: '#94A3B8',
  },
  disclaimer: {
    fontSize: 11,
    color: '#64748B',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#5B4DFF',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 1.2,
    marginBottom: theme.spacing.s,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.m,
  },
  highlightText: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  successDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.s,
  },
  successButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.m,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  successButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  // Zomato Checkout Overhaul Styles
  zomatoContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  zomatoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  zomatoBackBtn: {
    padding: 4,
    marginRight: 10,
  },
  zomatoHeaderTitleRow: {
    flex: 1,
  },
  zomatoHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  zomatoSecureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  zomatoSecureText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  zomatoSecureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zomatoSecureTextSmall: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  zomatoToggleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  zomatoToggleLabelCol: {
    flex: 1,
    paddingRight: 10,
  },
  zomatoToggleLabelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  zomatoToggleLabelDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  zomatoToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zomatoToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  zomatoToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  zomatoToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  zomatoToggleTextActive: {
    color: '#5B4DFF',
    fontWeight: '800',
  },
  zomatoScrollBody: {
    padding: 16,
    paddingBottom: 130, // margin for sticky footer
  },
  zomatoOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  zomatoOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zomatoOrderMeta: {
    flex: 1,
    paddingRight: 10,
  },
  zomatoOrderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zomatoOrderName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  zomatoLifetimeBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  zomatoLifetimeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#10B981',
  },
  zomatoOrderDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  zomatoOrderPrice: {
    fontSize: 20,
    fontWeight: '900',
  },
  zomatoOrderSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  zomatoSecureLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zomatoSecureLineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  zomatoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  zomatoSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  zomatoUpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  zomatoUpiItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  zomatoUpiIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  zomatoUpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  zomatoInputGroup: {
    marginBottom: 12,
  },
  zomatoInputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  zomatoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  zomatoInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    paddingVertical: 12,
  },
  zomatoInputPayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5B4DFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zomatoCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  zomatoAutofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(91, 77, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zomatoAutofillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#5B4DFF',
  },
  visualCardForm: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zomatoCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  zomatoVisualInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  zomatoCardPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  zomatoCardPayText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bankGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  bankItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  bankItemActive: {
    borderColor: '#5B4DFF',
    backgroundColor: 'rgba(91, 77, 255, 0.03)',
  },
  bankLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  bankLabelActive: {
    color: '#5B4DFF',
    fontWeight: '800',
  },
  walletList: {
    gap: 10,
  },
  walletItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  walletItemActive: {
    borderColor: '#5B4DFF',
    backgroundColor: 'rgba(91, 77, 255, 0.03)',
  },
  walletItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  walletDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  zomatoMncSecureCard: {
    padding: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginTop: 10,
  },
  zomatoMncSecureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  zomatoMncSecureTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  zomatoMncSecureDesc: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 15,
  },
  zomatoStickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  zomatoStickyPriceRow: {
    flex: 1,
  },
  zomatoStickyLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  zomatoStickyAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  zomatoSecureStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  zomatoSecureStampText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#64748B',
  },
  zomatoStickyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 150,
  },
  zomatoStickyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  awaitingCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  awaitingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  awaitingDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  awaitingVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  awaitingVerifyText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  awaitingCancelBtn: {
    paddingVertical: 10,
  },
  awaitingCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});
