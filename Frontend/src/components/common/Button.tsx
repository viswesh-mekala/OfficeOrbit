import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from '../../theme/theme';

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: 'primary' | 'secondary';
    style?: ViewStyle;
    textStyle?: TextStyle;
    disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    style,
    textStyle,
    disabled = false,
}) => {
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const shadowRadius = useSharedValue(8);
    const elevation = useSharedValue(5);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            shadowOpacity: shadowOpacity.value,
            shadowRadius: shadowRadius.value,
            elevation: elevation.value,
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.96, { damping: 10, stiffness: 300 });
        if (variant === 'primary') {
            shadowOpacity.value = withTiming(0.15, { duration: 150 });
            shadowRadius.value = withTiming(4, { duration: 150 });
            elevation.value = withTiming(2, { duration: 150 });
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 300 });
        if (variant === 'primary') {
            shadowOpacity.value = withTiming(0.3, { duration: 150 });
            shadowRadius.value = withTiming(8, { duration: 150 });
            elevation.value = withTiming(5, { duration: 150 });
        }
    };

    return (
        <AnimatedPressable
            style={[
                styles.container,
                variant === 'primary' && styles.primaryContainer,
                disabled && styles.disabled,
                style,
                animatedStyle
            ]}
            onPress={disabled ? undefined : onPress}
            onPressIn={disabled ? undefined : handlePressIn}
            onPressOut={disabled ? undefined : handlePressOut}
            disabled={disabled}
        >
            <Text style={[styles.text, variant === 'primary' && styles.primaryText, textStyle]}>
                {title}
            </Text>
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: 50, // Pill shape
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    primaryContainer: {
        backgroundColor: theme.colors.primary,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        // Shadow props are now handled by reanimated style, but defaults are good for initial render if needed
        // We leave them here but they will be overridden by the animated style updates
    },
    text: {
        fontSize: theme.typography.sizes.button,
        fontWeight: '600',
    },
    primaryText: {
        color: theme.colors.white,
    },
    disabled: {
        opacity: 0.5,
    },
});
