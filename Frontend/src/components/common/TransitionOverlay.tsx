import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
    FadeIn, 
    FadeOut, 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing,
    withSequence 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

interface TransitionOverlayProps {
    message?: string;
    subMessage?: string;
}

export const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ 
    message = "", 
    subMessage = ""
}) => {
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 1500, easing: Easing.linear }),
            -1
        );
        
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 800 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );
    }, []);

    const spinStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(800)}
            style={[styles.container, StyleSheet.absoluteFill]}
        >
            <LinearGradient
                colors={['#FFFFFF', '#F0F4FF']}
                style={styles.background}
            />
            
            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, pulseStyle]}>
                    <LinearGradient
                        colors={[theme.colors.primary, theme.colors.secondary]}
                        style={styles.iconGradient}
                    >
                        <Ionicons name="infinite" size={40} color="white" />
                    </LinearGradient>
                </Animated.View>

                {message && <Text style={styles.message}>{message}</Text>}
                {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999, // Ensure it sits on top of everything
        backgroundColor: '#FFFFFF', // Prevent interactions below
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        alignItems: 'center',
        padding: 40,
    },
    iconContainer: {
        marginBottom: 24,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    iconGradient: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text.primary,
        marginBottom: 8,
        textAlign: 'center',
    },
    subMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    }
});
