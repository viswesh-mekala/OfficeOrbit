import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    Dimensions,
    NativeSyntheticEvent,
    TextInputKeyPressEventData,
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
const RESEND_COOLDOWN = 60; // seconds

export const VerifyOTP: React.FC = () => {
    const { email } = useLocalSearchParams<{ email: string }>();
    const { verifyOtp, resendOtp } = useAuth();

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
    const [canResend, setCanResend] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

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

    const handleOtpChange = (text: string, index: number) => {
        // Strip non-digits
        const digits = text.replace(/[^0-9]/g, '');
        setError(null);

        // Handle PASTE — user pasted multiple digits (e.g. full OTP from clipboard)
        if (digits.length > 1) {
            const newOtp = [...otp];
            const pastedDigits = digits.slice(0, OTP_LENGTH).split('');
            
            // Fill from the first box (or current index)
            const startIndex = pastedDigits.length >= OTP_LENGTH ? 0 : index;
            for (let i = 0; i < pastedDigits.length && (startIndex + i) < OTP_LENGTH; i++) {
                newOtp[startIndex + i] = pastedDigits[i];
            }
            setOtp(newOtp);

            // Focus the last filled box or the next empty one
            const lastFilledIndex = Math.min(startIndex + pastedDigits.length, OTP_LENGTH) - 1;
            inputRefs.current[lastFilledIndex]?.focus();

            // Auto-submit if all boxes filled
            if (newOtp.every((d) => d !== '') && newOtp.join('').length === OTP_LENGTH) {
                handleVerify(newOtp.join(''));
            }
            return;
        }

        // Handle single digit typing
        const digit = digits.slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        // Auto-focus next input
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when complete
        if (newOtp.every((d) => d !== '') && newOtp.join('').length === OTP_LENGTH) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyPress = (
        e: NativeSyntheticEvent<TextInputKeyPressEventData>,
        index: number
    ) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            // Focus previous input on backspace if current is empty
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (code?: string) => {
        const otpCode = code || otp.join('');

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
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
            triggerShake();
            setIsSubmitting(false);
        } else {
            // Success! Navigate to signin
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
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
                <StatusBar style="dark" />

                <LinearGradient
                    colors={['#FFFFFF', '#F0F4FF', '#E8E4F6']}
                    style={styles.background}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                    >
                        {/* Back Button - goes to signup to try again */}
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.replace('/signup')}
                        >
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>

                        {/* Header Section */}
                        <Animated.View entering={FadeInUp.duration(800)} style={styles.header}>
                            <View style={styles.logoCircle}>
                                <Ionicons name="mail-open" size={28} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.welcomeText}>Verify Your Email</Text>
                            <Text style={styles.taglineText}>
                                Enter the 8-digit code sent to{'\n'}
                                <Text style={styles.emailText}>{maskedEmail}</Text>
                            </Text>
                        </Animated.View>

                        {/* Main White Card */}
                        <Animated.View
                            entering={FadeInUp.delay(200).duration(800).springify()}
                            style={styles.card}
                        >
                            {/* OTP Inputs */}
                            <Animated.View style={[styles.otpContainer, animatedStyle]}>
                                {otp.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { inputRefs.current[index] = ref; }}
                                        style={[
                                            styles.otpInput,
                                            digit && styles.otpInputFilled,
                                            error && styles.otpInputError,
                                        ]}
                                        value={digit}
                                        onChangeText={(text) => handleOtpChange(text, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </Animated.View>

                            {/* Error Message */}
                            {error && (
                                <Animated.View
                                    entering={FadeIn.duration(200)}
                                    style={styles.errorContainer}
                                >
                                    <Ionicons name="alert-circle" size={16} color="#D32F2F" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </Animated.View>
                            )}

                            {/* Verify Button */}
                            <Button
                                title={isSubmitting ? 'Verifying...' : 'Verify Email'}
                                onPress={() => handleVerify()}
                                style={{ marginTop: 24, marginBottom: 16 }}
                                disabled={isSubmitting || otp.join('').length !== OTP_LENGTH}
                            />

                            {/* Resend Section */}
                            <View style={styles.resendContainer}>
                                <Text style={styles.resendText}>Didn't receive the code?</Text>
                                {canResend ? (
                                    <TouchableOpacity
                                        onPress={handleResend}
                                        disabled={isResending}
                                        style={styles.resendButton}
                                    >
                                        <Text style={styles.resendButtonText}>
                                            {isResending ? 'Sending...' : 'Resend Code'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.countdownText}>
                                        Resend in {formatTime(countdown)}
                                    </Text>
                                )}
                            </View>
                        </Animated.View>

                        {/* Secure Footer */}
                        <Animated.View entering={FadeIn.delay(600)} style={styles.secureFooter}>
                            <Ionicons name="shield-checkmark" size={12} color="#999" />
                            <Text style={styles.secureText}>
                                Your verification is secure and encrypted.
                            </Text>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.m,
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
    },
    backButton: {
        alignSelf: 'flex-start',
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 2,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoCircle: {
        width: 56,
        height: 56,
        borderRadius: 20,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    taglineText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 22,
    },
    emailText: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        paddingVertical: 28,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 15 },
        elevation: 8,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    otpInput: {
        flex: 1,
        height: 52,
        backgroundColor: '#FAFAFA',
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#EFEFEF',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        color: '#333',
    },
    otpInputFilled: {
        borderColor: theme.colors.primary,
        backgroundColor: '#F8F7FF',
    },
    otpInputError: {
        borderColor: '#D32F2F',
        backgroundColor: '#FFF8F8',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16,
        padding: 12,
        backgroundColor: '#FFE8E8',
        borderRadius: 8,
    },
    errorText: {
        color: '#D32F2F',
        fontSize: 13,
        fontWeight: '500',
    },
    resendContainer: {
        alignItems: 'center',
        gap: 8,
    },
    resendText: {
        color: '#666',
        fontSize: 14,
    },
    resendButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    resendButtonText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '700',
    },
    countdownText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '600',
    },
    secureFooter: {
        marginTop: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    secureText: {
        color: 'rgba(102, 102, 102, 0.5)',
        fontSize: 12,
        fontWeight: '500',
    },
});
