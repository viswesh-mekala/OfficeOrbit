// Logic moved from src/app/index.tsx to here
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, Href, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Button } from '../components/common/Button';

export const LandingPage: React.FC = () => {
    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <LinearGradient
                colors={['#Eef2ff', '#ffffff', '#e0e7ff']}
                style={styles.background}
            />

            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoDesign}>
                        <View style={styles.pinContainer}>
                            <LinearGradient
                                colors={[theme.colors.primary, '#4facfe']}
                                style={styles.pinGradient}
                            >
                                <Ionicons name="checkmark" size={24} color="white" style={styles.checkIcon} />
                            </LinearGradient>
                        </View>
                    </View>
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title}>OfficeOrbit</Text>
                    <Text style={styles.subtitle}>
                        Intelligent work from office tracking{'\n'}for the modern workforce
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Link href={"/home" as Href} asChild>
                        <Button title="Get Started" />
                    </Link>
                    <Text style={styles.designerText}>Designed by Viswesh Nani</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    content: {
        flex: 1,
        paddingHorizontal: theme.spacing.l,
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.xxl * 1.5,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: theme.spacing.xxl * 2,
        flex: 1,
        justifyContent: 'center',
    },
    logoDesign: {
        width: 120,
        height: 120,
        backgroundColor: 'white',
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    pinContainer: {
    },
    pinGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomRightRadius: 5,
        transform: [{ rotate: '45deg' }],
    },
    checkIcon: {
        transform: [{ rotate: '-45deg' }],
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: theme.spacing.xxl,
    },
    title: {
        fontSize: theme.typography.sizes.title,
        fontWeight: '700',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
    },
    subtitle: {
        fontSize: theme.typography.sizes.subtitle,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        width: '100%',
        alignItems: 'center',
        gap: theme.spacing.l,
    },
    designerText: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        opacity: 0.5,
    },
});
