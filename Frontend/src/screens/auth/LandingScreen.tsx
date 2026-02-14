import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, Link, Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInUp,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { Button } from '../../components/common/Button';

const { width } = Dimensions.get('window');

const OrbitalHero = () => {
    const rotation = useSharedValue(0);
    const pulse = useSharedValue(1);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );
        pulse.value = withRepeat(
            withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedOrbitStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const pulsingCoreStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    return (
        <View style={styles.heroContainer}>
            <View style={styles.orbitSystem}>
                <Animated.View style={[styles.orbitRing, animatedOrbitStyle]}>
                    <View style={[styles.satellite, { top: -20, left: '50%', transform: [{ translateX: -20 }] }]}>
                        <Link href={"/dashboard" as Href} asChild>
                            <Ionicons name="home" size={20} color={theme.colors.primary} />
                        </Link>
                    </View>
                    <View style={[styles.satellite, { bottom: -20, left: '50%', transform: [{ translateX: -20 }] }]}>
                        <Ionicons name="stats-chart" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={[styles.satellite, { top: '50%', left: -20, transform: [{ translateY: -20 }] }]}>
                        <Ionicons name="business" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={[styles.satellite, { top: '50%', right: -20, transform: [{ translateY: -20 }] }]}>
                        <Ionicons name="location" size={20} color={theme.colors.primary} />
                    </View>
                </Animated.View>

                <Animated.View style={[styles.coreWrapper, pulsingCoreStyle]}>
                    <BlurView intensity={60} tint="light" style={styles.coreGlass}>
                        <View style={styles.coreInner}>
                            <Ionicons name="infinite" size={48} color={theme.colors.primary} />
                        </View>
                    </BlurView>
                </Animated.View>
            </View>

            <Animated.View entering={FadeInUp.delay(200)} style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>WORKSPACE ACTIVE</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400)} style={styles.textContainer}>
                <Text style={styles.title}>OfficeOrbit</Text>
                <Text style={styles.subtitle}>
                    Synchronize your workforce with precision. Intelligence for the modern Hybrid office.
                </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(600)} style={styles.buttonContainer}>
                <Button
                    title="Get Started"
                    onPress={() => router.replace('/signup' as any)}
                    variant="primary"
                    style={{ width: 200, marginBottom: 16 }}
                />
                <TouchableOpacity onPress={() => router.replace('/signin' as any)}>
                    <Text style={styles.signInText}>
                        Already have an account? <Text style={styles.signInLink}>Sign In</Text>
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

export const LandingPage: React.FC = () => {
    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <LinearGradient
                colors={['#FFFFFF', '#F0F4FF', '#E8EAF6']}
                style={styles.background}
            />
            <OrbitalHero />
            <View style={styles.footer}>
                <Text style={styles.footerText}>Designed by Viswesh</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    heroContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingHorizontal: 20,
    },
    orbitSystem: {
        width: 280,
        height: 280,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    orbitRing: {
        width: '100%',
        height: '100%',
        borderRadius: 140,
        borderWidth: 1,
        borderColor: 'rgba(91, 77, 255, 0.15)',
        position: 'absolute',
        borderStyle: 'dashed',
    },
    satellite: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    coreWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10,
    },
    coreGlass: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    coreInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.primary,
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4CAF50',
        marginRight: 8,
    },
    statusText: {
        color: '#666',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 40,
        maxWidth: width * 0.8,
    },
    title: {
        fontSize: 42,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 12,
        letterSpacing: -1,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
    },
    signInText: {
        color: '#666',
        fontSize: 14,
    },
    signInLink: {
        fontWeight: '700',
        color: theme.colors.primary,
        textDecorationLine: 'underline',
    },
    footer: {
        position: 'absolute',
        bottom: 32,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(0,0,0,0.25)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
