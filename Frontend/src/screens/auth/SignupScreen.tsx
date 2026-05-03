import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme/theme';
import { Button } from '../../components/common/Button';
import { GoogleIcon } from '../../components/icons/GoogleIcon';
import { useAuth } from '../../store/AuthContext';

// ── Password strength rules ──────────────────────────────
type RuleKey = 'length' | 'upper' | 'number' | 'symbol';

const PASSWORD_RULES: { key: RuleKey; label: string; test: (p: string) => boolean }[] = [
    { key: 'length',  label: 'At least 8 characters',       test: (p) => p.length >= 8 },
    { key: 'upper',   label: 'One uppercase letter (A–Z)',   test: (p) => /[A-Z]/.test(p) },
    { key: 'number',  label: 'One number (0–9)',             test: (p) => /[0-9]/.test(p) },
    { key: 'symbol',  label: 'One symbol (!@#$…)',           test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const getStrengthMeta = (passed: number) => {
    if (passed === 0) return { label: '',          color: '#E0E0E0', barColor: '#E0E0E0', bars: 0 };
    if (passed === 1) return { label: 'Weak',      color: '#D32F2F', barColor: '#D32F2F', bars: 1 };
    if (passed === 2) return { label: 'Fair',      color: '#FF9800', barColor: '#FF9800', bars: 2 };
    if (passed === 3) return { label: 'Good',      color: '#2196F3', barColor: '#2196F3', bars: 3 };
    return              { label: 'Strong 🔒',      color: '#4CAF50', barColor: '#4CAF50', bars: 4 };
};

// ── User-already-exists detection ─────────────────────────
// authService throws the raw 'user already registered' string (bypasses friendlyErrorMessage)
const isUserExistsError = (msg: string) =>
    /already registered|already exists|user already|email already/i.test(msg);

export const Signup: React.FC = () => {
    const { signUpWithEmail, signInWithGoogle } = useAuth();
    const [username, setUsername]         = useState('');
    const [email, setEmail]               = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRules, setShowRules]       = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError]               = useState<string | null>(null);
    const [userExists, setUserExists]     = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // ── Keyboard height tracker ──
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, (e) =>
            setKeyboardHeight(e.endCoordinates.height)
        );
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    // ── Password strength ──
    const ruleResults = PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) }));
    const passedCount = ruleResults.filter((r) => r.passed).length;
    const strength    = getStrengthMeta(password.length > 0 ? passedCount : 0);

    // ── Handlers ──
    const handleSignup = async () => {
        setUserExists(false);
        if (!username.trim() || !email.trim() || !password) {
            setError('Please fill in all fields');
            return;
        }
        if (passedCount < 3) {
            setError('Please choose a stronger password');
            setShowRules(true);
            return;
        }
        setError(null);
        setIsSubmitting(true);

        const result = await signUpWithEmail(email.trim(), password, username.trim());

        if (result.error) {
            const msg = result.error.message;
            if (isUserExistsError(msg)) {
                setUserExists(true);
                setError(null);
            } else {
                setError(msg);
            }
            setIsSubmitting(false);
        } else {
            setIsSubmitting(false);
            router.replace({
                pathname: '/verify-otp' as const,
                params: { email: email.trim() },
            } as any);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setIsSubmitting(true);
        const { error } = await signInWithGoogle();
        setIsSubmitting(false);
        if (error) setError(error.message);
    };

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
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollInner,
                        { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 32 : 40 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    {/* Header */}
                    <Animated.View entering={FadeInUp.duration(700)} style={styles.header}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="person-add" size={26} color={theme.colors.primary} />
                        </View>
                        <Text style={styles.welcomeText}>Create Account</Text>
                        <Text style={styles.taglineText}>Join Orbit for premium tracking</Text>
                    </Animated.View>

                    {/* Card */}
                    <Animated.View
                        entering={FadeInUp.delay(180).duration(700).springify()}
                        style={styles.card}
                    >
                        {/* ── "User already exists" banner ── */}
                        {userExists && (
                            <Animated.View entering={FadeIn.duration(250)} style={styles.existsBanner}>
                                <Ionicons name="person-circle-outline" size={20} color="#7B1FA2" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.existsTitle}>Account already exists</Text>
                                    <Text style={styles.existsSubtitle}>
                                        <Text style={styles.existsEmail}>{email}</Text> is already registered.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.existsSignInBtn}
                                    onPress={() => router.replace('/signin')}
                                >
                                    <Text style={styles.existsSignInText}>Sign In →</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}

                        {/* Form */}
                        <View style={styles.form}>
                            {/* Username */}
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={18} color="#AAA" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="Username"
                                    placeholderTextColor="#C0C0C0"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="words"
                                    editable={!isSubmitting}
                                    returnKeyType="next"
                                />
                            </View>

                            {/* Email */}
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={18} color="#AAA" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="Email address"
                                    placeholderTextColor="#C0C0C0"
                                    value={email}
                                    onChangeText={(t) => {
                                        setEmail(t);
                                        setUserExists(false);
                                    }}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    editable={!isSubmitting}
                                    returnKeyType="next"
                                />
                            </View>

                            {/* Password */}
                            <View
                                style={[
                                    styles.inputWrapper,
                                    showRules && styles.inputWrapperFocused,
                                ]}
                            >
                                <Ionicons name="lock-closed-outline" size={18} color="#AAA" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="Password"
                                    placeholderTextColor="#C0C0C0"
                                    value={password}
                                    onChangeText={(t) => {
                                        setPassword(t);
                                        if (!showRules && t.length > 0) setShowRules(true);
                                    }}
                                    secureTextEntry={!showPassword}
                                    editable={!isSubmitting}
                                    returnKeyType="done"
                                    onSubmitEditing={handleSignup}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                    disabled={isSubmitting}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={18}
                                        color="#AAA"
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* ── Strength bar + rules ── */}
                            {showRules && password.length > 0 && (
                                <Animated.View entering={FadeIn.duration(200)} style={styles.strengthBlock}>
                                    {/* Bar */}
                                    <View style={styles.strengthBarRow}>
                                        {[0, 1, 2, 3].map((i) => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.strengthSegment,
                                                    {
                                                        backgroundColor:
                                                            i < strength.bars
                                                                ? strength.barColor
                                                                : '#EBEBEB',
                                                    },
                                                ]}
                                            />
                                        ))}
                                        <Text style={[styles.strengthLabel, { color: strength.color }]}>
                                            {strength.label}
                                        </Text>
                                    </View>

                                    {/* Rule checklist */}
                                    {ruleResults.map((r) => (
                                        <View key={r.key} style={styles.ruleRow}>
                                            <Ionicons
                                                name={r.passed ? 'checkmark-circle' : 'ellipse-outline'}
                                                size={13}
                                                color={r.passed ? '#4CAF50' : '#BBBBCC'}
                                            />
                                            <Text
                                                style={[
                                                    styles.ruleText,
                                                    r.passed && styles.ruleTextPassed,
                                                ]}
                                            >
                                                {r.label}
                                            </Text>
                                        </View>
                                    ))}
                                </Animated.View>
                            )}

                            {/* Generic error */}
                            {error && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle-outline" size={14} color="#D32F2F" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}
                        </View>

                        {/* Create Account button */}
                        <Button
                            title="Create Account"
                            onPress={handleSignup}
                            loading={isSubmitting}
                            style={{ marginBottom: 14 }}
                        />

                        {/* Sign-in link */}
                        <TouchableOpacity
                            onPress={() => router.replace('/signin' as any)}
                            style={styles.signInLinkRow}
                        >
                            <Text style={styles.signInLinkText}>
                                Already have an account?{' '}
                                <Text style={styles.signInLinkHighlight}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>Or quick access</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Google */}
                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={handleGoogleSignIn}
                            disabled={isSubmitting}
                        >
                            <GoogleIcon size={18} />
                            <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Footer */}
                    <Animated.View entering={FadeIn.delay(500)} style={styles.footer}>
                        <Ionicons name="shield-checkmark" size={12} color="#BBB" />
                        <Text style={styles.footerText}>Your data is secure and encrypted.</Text>
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
    scrollInner: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 70 : 50,
    },

    // Header
    header: {
        alignItems: 'center',
        marginBottom: 24,
        width: '100%',
    },
    logoCircle: {
        width: 58,
        height: 58,
        borderRadius: 20,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
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
        marginBottom: 6,
        letterSpacing: -0.5,
    },
    taglineText: {
        fontSize: 14,
        color: '#888',
        fontWeight: '400',
    },

    // Card
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: 'white',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 26,
        paddingBottom: 22,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
    },

    // User-exists banner
    existsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F3E5F5',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#CE93D8',
    },
    existsTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6A1B9A',
    },
    existsSubtitle: {
        fontSize: 12,
        color: '#7B1FA2',
        marginTop: 1,
    },
    existsEmail: {
        fontWeight: '700',
    },
    existsSignInBtn: {
        backgroundColor: '#7B1FA2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    existsSignInText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },

    // Form
    form: {
        gap: 12,
        marginBottom: 22,
    },
    inputWrapper: {
        backgroundColor: '#FAFAFA',
        borderRadius: 13,
        borderWidth: 1.5,
        borderColor: '#EFEFEF',
        paddingHorizontal: 14,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputWrapperFocused: {
        borderColor: `${theme.colors.primary}50`,
    },
    inputIcon: {
        marginRight: 10,
    },
    inputField: {
        flex: 1,
        fontSize: 14,
        color: '#222',
        height: '100%',
    },
    eyeIcon: {
        padding: 4,
    },

    // Strength block
    strengthBlock: {
        gap: 7,
        paddingHorizontal: 2,
        marginTop: -4,
    },
    strengthBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    strengthSegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 11,
        fontWeight: '700',
        width: 60,
        textAlign: 'right',
    },
    ruleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ruleText: {
        fontSize: 12,
        color: '#BBBBCC',
        fontWeight: '500',
    },
    ruleTextPassed: {
        color: '#4CAF50',
    },

    // Error
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: '#FFF0F0',
        borderRadius: 10,
        padding: 11,
        borderWidth: 1,
        borderColor: '#FFCDD2',
        marginTop: -4,
    },
    errorText: {
        color: '#D32F2F',
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },

    // Sign-in link
    signInLinkRow: {
        alignItems: 'center',
        marginBottom: 18,
    },
    signInLinkText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '400',
    },
    signInLinkHighlight: {
        color: theme.colors.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },

    // Divider
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#EEE',
    },
    dividerText: {
        color: '#BBB',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Google
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 48,
        backgroundColor: '#FFF',
        borderWidth: 1.5,
        borderColor: '#E8E8E8',
        borderRadius: 13,
    },
    googleButtonText: {
        color: '#333',
        fontSize: 14,
        fontWeight: '600',
    },

    // Footer
    footer: {
        marginTop: 24,
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
