import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    runOnJS, 
    interpolate, 
    Extrapolation,
    withTiming
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_HEIGHT = 56; // Standard touch target
const BUTTON_PADDING = 4;
const SWIPE_WIDTH = SCREEN_WIDTH - 32 - 8; // Screen padding (16*2) - Button padding

interface SlideActionProps {
    onSwipeSuccess: () => void;
    label?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    color?: string;
    disabled?: boolean;
    loading?: boolean;
}

export const SlideAction: React.FC<SlideActionProps> = ({ 
    onSwipeSuccess, 
    label = "Slide to Confirm", 
    icon = "chevron-forward",
    color = theme.colors.primary,
    disabled = false,
    loading = false
}) => {
    const translateX = useSharedValue(0);
    const maxTranslateX = SWIPE_WIDTH - BUTTON_HEIGHT;

    const onSuccess = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSwipeSuccess();
        translateX.value = withTiming(0, { duration: 220 });
    };

    const pan = Gesture.Pan()
        .enabled(!disabled && !loading)
        .onUpdate((event) => {
            const translation = event.translationX;
            // Clamp between 0 and max
            translateX.value = Math.min(Math.max(translation, 0), maxTranslateX);
        })
        .onEnd(() => {
            if (translateX.value > maxTranslateX * 0.8) {
                // Success threshold
                translateX.value = withSpring(maxTranslateX);
                runOnJS(onSuccess)();
            } else {
                // Reset
                translateX.value = withSpring(0);
            }
        });

    const buttonStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
            backgroundColor: theme.colors.white,
        };
    });

    const trackStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            translateX.value, 
            [0, maxTranslateX * 0.5], 
            [1, 0], 
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    const overlayStyle = useAnimatedStyle(() => {
        const width = interpolate(
            translateX.value,
            [0, maxTranslateX],
            [BUTTON_HEIGHT, SWIPE_WIDTH + BUTTON_PADDING * 2], // Expand to cover
            Extrapolation.CLAMP
        );
        return {
            width,
            backgroundColor: color,
            opacity: interpolate(translateX.value, [0, maxTranslateX], [0.1, 1]), 
        };
    });

    return (
        <View style={[styles.container, { opacity: disabled ? 0.6 : 1 }]}>
            {/* Background Track */}
            <View style={[styles.track, { backgroundColor: theme.colors.background }]}>
                
                {/* Progress Overlay (Color Fill) */}
                <Animated.View style={[styles.progressOverlay, overlayStyle]} />

                {/* Label */}
                <Animated.View style={[styles.labelContainer, trackStyle]}>
                    <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
                        {loading ? "Please wait..." : label}
                    </Text>
                </Animated.View>

                {/* Knob */}
                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.button, buttonStyle]}>
                        <Ionicons 
                            name={icon} 
                            size={24} 
                            color={color} 
                        />
                    </Animated.View>
                </GestureDetector>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 80, // Container height including padding
        justifyContent: 'center',
        alignItems: 'center',
    },
    track: {
        width: '100%',
        height: BUTTON_HEIGHT + BUTTON_PADDING * 2,
        borderRadius: (BUTTON_HEIGHT + BUTTON_PADDING * 2) / 2,
        justifyContent: 'center',
        padding: BUTTON_PADDING,
        backgroundColor: '#F0F0F0', // fallback
        overflow: 'hidden',
    },
    progressOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        borderRadius: BUTTON_HEIGHT / 2, // Approximate
    },
    button: {
        width: BUTTON_HEIGHT,
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3, // Android shadow
    },
    labelContainer: {
        position: 'absolute',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: -1,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
