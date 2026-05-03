import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Keyboard,
    ScrollView,
    Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
    FadeInUp,
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme/theme';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../store/AuthContext';

const { width } = Dimensions.get('window');
const OTP_LENGTH = 8;
const RESEND_COOLDOWN = 60;

export const VerifyOTP: React.FC = () => {
    const { email } = useLocalSearchParams<{ email: string }>();
    const { verifyOtp, resendOtp } = useAuth();

    const [otpValue, setOtpValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
    const [canResend, setCanResend] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const inputRef = useRef<TextInput>(null);
    const scrollRef = useRef<ScrollView>(null);

    // Track keyboard height so card scrolls above it
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, (e) =>
            setKeyboardHeight(e.endCoordinates.height)
        );
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Shake animation for error
    const shakeX = useSharedValue(0);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.value }],
    }));

    const triggerShake = () => {
        shakeX.value = withSequence(
            withTiming(-10, { duration: 50 }),
            withTiming(10, { duration: 50 }),
            withTiming(-10, { duration: 50 }),
            withTiming(10, { duration: 50 }),
            withTiming(0, { duration: 50 })
        );
    };

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    const digits = otpValue.padEnd(OTP_LENGTH, ' ').split('').slice(0, OTP_LENGTH);
    const filledCount = otpValue.replace(/[^0-9]/g, '').length;

    const handleOtpChange = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
        setOtpValue(cleaned);
        setError(null);

        if (cleaned.length === OTP_LENGTH) {
            Keyboard.dismiss();
            handleVerify(cleaned);
        }
    };

    const handleVerify = async (code?: string) => {
        const otpCode = code || otpValue;

        if (otpCode.length !== OTP_LENGTH) {
            setError('Please enter the complete 8-digit code');
            triggerShake();
            return;
        }

        if (!email) {
            setError('Email not found. Please try signing up again.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const { error } = await verifyOtp(email, otpCode);

        if (error) {
            setError('Invalid verification code. Please try again.');
            setOtpValue('');
            inputRef.current?.focus();
            triggerShake();
            setIsSubmitting(false);
        } else {
            router.replace('/signin');
        }
    };

    const handleResend = async () => {
        if (!canResend || !email) return;
        setIsResending(true);
        setError(null);
        const { error } = await resendOtp(email);
        if (error) {
            setError('Failed to resend code. Please try again.');
        } else {
            setCountdown(RESEND_COOLDOWN);
            setCanResend(false);
            setOtpValue('');
            inputRef.current?.focus();
        }
        setIsResending(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const maskedEmail = email
        ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        : 'your email';

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <LinearGradient
                colors={['#FFFFFF', '#F0F4FF', '#E8E4F6']}
                style={StyleSheet.absoluteFill}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 32 : 32 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    {/* Back Button */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.replace('/signup')}
                    >
                        <Ionicons name="arrow-back" size={22} color="#333" />
                    </TouchableOpacity>

                    {/* Header */}
                    <Animated.View entering={FadeInUp.duration(700)} style={styles.header}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="mail-open" size={26} color={theme.colors.primary} />
                        </View>
                        <Text style={styles.welcomeText}>Check your inbox</Text>
                        <Text style={styles.taglineText}>
                            We sent an 8-digit code to{'\n'}
                            <Text style={styles.emailHighlight}>{maskedEmail}</Text>
                        </Text>
                    </Animated.View>

                    {/* Card */}
                    <Animated.View
                        entering={FadeInUp.delay(180).duration(700).springify()}
                        style={styles.card}
                    >
                        <Text style={styles.cardLabel}>Enter verification code</Text>

                        {/* Netflix-style underline slots */}
                        <Animated.View style={[styles.slotsWrapper, animatedStyle]}>
                            {/* The real input — invisible but on top of the slots */}
                            <TextInput
                                ref={inputRef}
                                style={styles.realInput}
                                value={otpValue}
                                onChangeText={handleOtpChange}
                                keyboardType="number-pad"
                                maxLength={OTP_LENGTH}
                                autoFocus
                                caretHidden
                                textContentType="oneTimeCode"
                                autoComplete="one-time-code"
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            />

                            {/* Visual slot row */}
                            <TouchableOpacity
                                style={styles.slotRow}
                                activeOpacity={1}
                                onPress={() => inputRef.current?.focus()}
                            >
                                {digits.map((char, i) => {
                                    const filled = char.trim() !== '';
                                    const isActive = isFocused && filledCount === i;
                                    const hasError = !!error;
                                    return (
                                        <View key={i} style={styles.slotCell}>
                                            <Text
                                                style={[
                                                    styles.slotChar,
                                                    filled && styles.slotCharFilled,
                                                    hasError && styles.slotCharError,
                                                ]}
                                            >
                                                {filled ? char : ''}
                                            </Text>
                                            {/* Underline */}
                                            <View
                                                style={[
                                                    styles.slotLine,
                                                    filled && !hasError && styles.slotLineFilled,
                                                    isActive && !hasError && styles.slotLineActive,
                                                    hasError && styles.slotLineError,
                                                ]}
                                            />
                                            {/* Blinking cursor */}
                                            {isActive && !hasError && (
                                                <View style={styles.cursor} />
                                            )}
                                        </View>
                                    );
                                })}
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Progress hint */}
                        <Text style={styles.progressHint}>
                            {filledCount === 0
                                ? 'Type or paste your code'
                                : filledCount < OTP_LENGTH
                                ? `${OTP_LENGTH - filledCount} digits remaining`
                                : 'Verifying…'}
                        </Text>

                        {/* Error */}
                        {error && (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                style={styles.errorBanner}
                            >
                                <Ionicons name="alert-circle" size={15} color="#D32F2F" />
                                <Text style={styles.errorText}>{error}</Text>
                            </Animated.View>
                        )}

                        {/* Verify Button */}
                        <Button
                            title={isSubmitting ? 'Verifying…' : 'Verify Email'}
                            onPress={() => handleVerify()}
                            style={styles.verifyButton}
                            disabled={isSubmitting || filledCount !== OTP_LENGTH}
                        />

                        {/* Resend */}
                        <View style={styles.resendRow}>
                            <Text style={styles.resendText}>Didn't receive the code? </Text>
                            {canResend ? (
                                <TouchableOpacity onPress={handleResend} disabled={isResending}>
                                    <Text style={styles.resendLink}>
                                        {isResending ? 'Sending…' : 'Resend'}
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.resendCountdown}>
                                    {formatTime(countdown)}
                                </Text>
                            )}
                        </View>
                    </Animated.View>

                    {/* Footer */}
                    <Animated.View entering={FadeIn.delay(500)} style={styles.footer}>
                        <Ionicons name="shield-checkmark" size={12} color="#BBB" />
                        <Text style={styles.footerText}>
                            Secure & encrypted verification
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 55 : 36,
        paddingBottom: 32,
    },

    // Back button
    backButton: {
        alignSelf: 'flex-start',
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 18,
        width: '100%',
    },
    logoCircle: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    welcomeText: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    taglineText: {
        fontSize: 14,
        color: '#777',
        fontWeight: '400',
        textAlign: 'center',
        lineHeight: 22,
    },
    emailHighlight: {
        color: theme.colors.primary,
        fontWeight: '700',
    },

    // Card
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: 'white',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
    },
    cardLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 24,
        textAlign: 'center',
    },

    // Underline slots
    slotsWrapper: {
        position: 'relative',
        marginBottom: 4,
    },
    realInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
        zIndex: 10,
    },
    slotRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 6,
    },
    slotCell: {
        flex: 1,
        alignItems: 'center',
        paddingBottom: 6,
        position: 'relative',
    },
    slotChar: {
        fontSize: 26,
        fontWeight: '700',
        color: '#CCC',
        height: 38,
        lineHeight: 38,
    },
    slotCharFilled: {
        color: '#1A1A2E',
    },
    slotCharError: {
        color: '#D32F2F',
    },
    slotLine: {
        height: 2.5,
        width: '100%',
        borderRadius: 2,
        backgroundColor: '#E0E0EE',
    },
    slotLineFilled: {
        backgroundColor: theme.colors.primary,
    },
    slotLineActive: {
        backgroundColor: theme.colors.secondary,
        height: 3,
    },
    slotLineError: {
        backgroundColor: '#D32F2F',
    },
    cursor: {
        position: 'absolute',
        bottom: 10,
        width: 2,
        height: 22,
        borderRadius: 1,
        backgroundColor: theme.colors.secondary,
    },

    // Progress
    progressHint: {
        fontSize: 12,
        color: '#BBBBCC',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 4,
    },

    // Error
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 14,
        marginBottom: 4,
        padding: 11,
        backgroundColor: '#FFF0F0',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    errorText: {
        color: '#D32F2F',
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },

    // Verify button
    verifyButton: {
        marginTop: 14,
        marginBottom: 14,
    },

    // Resend
    resendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resendText: {
        color: '#999',
        fontSize: 13,
        fontWeight: '400',
    },
    resendLink: {
        color: theme.colors.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    resendCountdown: {
        color: '#AAAACC',
        fontSize: 13,
        fontWeight: '600',
    },

    // Footer
    footer: {
        marginTop: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerText: {
        color: 'rgba(102, 102, 102, 0.5)',
        fontSize: 12,
        fontWeight: '500',
    },
});
