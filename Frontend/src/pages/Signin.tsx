import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/theme';
import { Button } from '../components/common/Button';

const { width } = Dimensions.get('window');

export const Signin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAuth = () => {
        setIsSubmitting(true);
        // Small delay for button feel, then navigate
        setTimeout(() => {
            router.replace('/dashboard');
        }, 500);
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Light Gradient Background */}
            <LinearGradient
                colors={['#FFFFFF', '#F0F4FF', '#E8E4F6']}
                style={styles.background}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                {/* Header Section */}
                <Animated.View entering={FadeInUp.duration(800)} style={styles.header}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="infinite" size={32} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.welcomeText}>Welcome to Orbit</Text>
                    <Text style={styles.taglineText}>Premium intelligence for your workspace</Text>
                </Animated.View>

                {/* Main White Card */}
                {!isSubmitting && (
                    <Animated.View
                        entering={FadeInUp.delay(200).duration(800).springify()}
                        exiting={FadeIn.duration(300)}
                        style={styles.card}
                    >
                        {/* Inputs */}
                        <View style={styles.form}>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    placeholderTextColor="#999"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#999"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color="#999"
                                    />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.forgotContainer}>
                                <Text style={styles.forgotText}>Forgot Password?</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Action Button */}
                        <Button
                            title="Enter Orbit"
                            onPress={handleAuth}
                            style={{ marginBottom: 20 }}
                        />

                        {/* Sign Up Link */}
                        <TouchableOpacity
                            onPress={() => router.push('/signup')}
                            style={styles.signupLinkContainer}
                        >
                            <Text style={styles.signupLinkText}>
                                Don't have an account? <Text style={styles.signupLinkHighlight}>Sign Up</Text>
                            </Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>Or continue with</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Social Grid */}
                        <View style={styles.socialRow}>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-google" size={20} color="#333" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-apple" size={20} color="#333" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.socialButton}>
                                <Ionicons name="logo-microsoft" size={20} color="#333" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}

                {/* Secure Footer */}
                <Animated.View entering={FadeIn.delay(600)} style={styles.secureFooter}>
                    <Ionicons name="lock-closed" size={12} color="#999" />
                    <Text style={styles.secureText}>Enterprise SSO available for corporate teams.</Text>
                </Animated.View>

            </KeyboardAvoidingView>
        </View>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.m,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoCircle: {
        width: 56,
        height: 56,
        borderRadius: 20,
        backgroundColor: 'white', // White bg
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: theme.colors.primary, // Shadow
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A', // Dark text
        marginBottom: 8,
    },
    taglineText: {
        fontSize: 14,
        color: '#666', // Darker grey text
        fontWeight: '500',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: 'white', // White card
        borderRadius: 24,
        padding: 24,
        paddingVertical: 28,
        shadowColor: '#000', // Shadow
        shadowOpacity: 0.08,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 15 },
        elevation: 8,
    },
    form: {
        gap: 12,
        marginBottom: 20,
    },
    inputWrapper: {
        backgroundColor: '#FAFAFA', // Light grey bg
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF', // Light border
        paddingHorizontal: 16,
        height: 48,
        justifyContent: 'center',
    },
    input: {
        fontSize: 14,
        color: '#333', // Dark text
        height: '100%',
    },
    eyeIcon: {
        position: 'absolute',
        right: 16,
        color: '#999', // Darker grey icon
    },
    forgotContainer: {
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    forgotText: {
        color: theme.colors.primary,
        fontWeight: '600',
        fontSize: 12,
    },
    actionButton: {
        backgroundColor: theme.colors.primary,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.5,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
    },
    actionButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    signupLinkContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    signupLinkText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    signupLinkHighlight: {
        color: theme.colors.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#EEE', // Light grey line
    },
    dividerText: {
        color: '#BBB', // Light grey text
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    socialRow: {
        flexDirection: 'row',
        gap: 12,
    },
    socialButton: {
        flex: 1,
        height: 48,
        backgroundColor: '#FFF', // White bg
        borderWidth: 1,
        borderColor: '#EEE', // Light border
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secureFooter: {
        marginTop: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    secureText: {
        color: 'rgba(102, 102, 102, 0.5)', // #666 with 0.5 opacity
        fontSize: 12,
        fontWeight: '500',
    },
});
