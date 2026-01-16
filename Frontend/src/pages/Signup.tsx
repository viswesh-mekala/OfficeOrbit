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

export const Signup: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSignup = () => {
        setIsSubmitting(true);
        // Small delay for button feel, then navigate
        setTimeout(() => {
            // TODO: Integrate actual signup logic here
            router.replace('/home');
        }, 500);
    };

    const navigateToLogin = () => {
        router.push('/login');
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
                        <Ionicons name="person-add" size={28} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.welcomeText}>Create Account</Text>
                    <Text style={styles.taglineText}>Join Orbit for premium tracking</Text>
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
                                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputWithIcon}
                                    placeholder="Username"
                                    placeholderTextColor="#999"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputWithIcon}
                                    placeholder="Email"
                                    placeholderTextColor="#999"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.inputWithIcon}
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
                        </View>

                        {/* Action Button */}
                        <Button
                            title="Create Account"
                            onPress={handleSignup}
                            style={{ marginBottom: 16 }}
                        />

                        {/* Login Link */}
                        <TouchableOpacity onPress={navigateToLogin} style={styles.loginLinkContainer}>
                            <Text style={styles.loginLinkText}>
                                Already have an account? <Text style={styles.loginLinkHighlight}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>Or quick access</Text>
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
                    <Ionicons name="shield-checkmark" size={12} color="#999" />
                    <Text style={styles.secureText}>Your data is secure and encrypted.</Text>
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
    form: {
        gap: 12,
        marginBottom: 24,
    },
    inputWrapper: {
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        paddingHorizontal: 16,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputIcon: {
        marginRight: 10,
    },
    inputWithIcon: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        height: '100%',
    },
    eyeIcon: {
        padding: 4,
    },
    actionButton: {
        backgroundColor: theme.colors.primary,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
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
    loginLinkContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    loginLinkText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    loginLinkHighlight: {
        color: theme.colors.primary,
        fontWeight: '700',
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
        backgroundColor: '#EEE',
    },
    dividerText: {
        color: '#BBB',
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
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#EEE',
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
        color: 'rgba(102, 102, 102, 0.5)',
        fontSize: 12,
        fontWeight: '500',
    },
});
