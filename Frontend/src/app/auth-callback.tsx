import React, { useEffect
} from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { 
    FadeIn, 
    FadeOut, 
    useAnimatedStyle, 
    useSharedValue, 
    withRepeat, 
    withTiming,
    withSequence,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { useAuth } from '../store/AuthContext';

const { width } = Dimensions.get('window');

export default function AuthCallback() {
    const { user, loading } = useAuth();
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const checkScale = useSharedValue(0);
    const textOpacity = useSharedValue(0);

    useEffect(() => {
        // Spinning animation for the loader
        rotation.value = withRepeat(
            withTiming(360, { duration: 1000, easing: Easing.linear }),
            -1,
            false
        );

        // Pulse animation
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            -1,
            true
        );
    }, []);

    useEffect(() => {
        if (!loading) {
            if (user) {
                // Success! Show checkmark animation
                checkScale.value = withSequence(
                    withTiming(1.2, { duration: 200 }),
                    withTiming(1, { duration: 150 })
                );
                textOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));

                // Auth guard in _layout.tsx will handle navigation automatically
                // based on profile completeness (→ onboarding or → dashboard)
            } else {
                // No user found — redirect to signin after brief delay
                setTimeout(() => {
                    router.replace('/signin' as any);
                }, 1000);
            }
        }
    }, [user, loading]);

    const spinStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
        opacity: checkScale.value,
    }));

    const welcomeTextStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
    }));

    const isSuccess = !loading && user;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#F8F7FF', '#F0F4FF', '#E8E4F6']}
                style={styles.background}
            />

            <Animated.View 
                entering={FadeIn.duration(500)} 
                exiting={FadeOut.duration(300)}
                style={styles.content}
            >
                {/* Animated Circle */}
                <Animated.View style={[styles.iconContainer, pulseStyle]}>
                    <LinearGradient
                        colors={[theme.colors.primary, theme.colors.secondary]}
                        style={styles.iconGradient}
                    >
                        {isSuccess ? (
                            <Animated.View style={checkStyle}>
                                <Ionicons name="checkmark" size={50} color="white" />
                            </Animated.View>
                        ) : (
                            <Animated.View style={spinStyle}>
                                <Ionicons name="sync" size={40} color="white" />
                            </Animated.View>
                        )}
                    </LinearGradient>
                </Animated.View>

                {/* Status Text */}
                <View style={styles.textContainer}>
                    {isSuccess ? (
                        <>
                            <Animated.Text style={[styles.title, welcomeTextStyle]}>
                                Welcome Back!
                            </Animated.Text>
                            <Animated.Text style={[styles.subtitle, welcomeTextStyle]}>
                                {user?.email}
                            </Animated.Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Signing you in...</Text>
                            <Text style={styles.subtitle}>Please wait a moment</Text>
                        </>
                    )}
                </View>

                {/* Progress dots */}
                {!isSuccess && (
                    <View style={styles.dotsContainer}>
                        {[0, 1, 2].map((i) => (
                            <Animated.View
                                key={i}
                                entering={FadeIn.delay(i * 200).duration(400)}
                                style={[styles.dot, { opacity: 0.4 + (i * 0.2) }]}
                            />
                        ))}
                    </View>
                )}
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
                <Ionicons name="shield-checkmark" size={14} color="#999" />
                <Text style={styles.footerText}>Securely authenticated</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F7FF',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        marginBottom: 40,
    },
    iconGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 40,
        gap: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.primary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
        gap: 6,
    },
    footerText: {
        fontSize: 13,
        color: '#999',
    },
});
