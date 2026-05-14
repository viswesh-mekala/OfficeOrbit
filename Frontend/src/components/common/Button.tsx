import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat, Easing, useAnimatedProps } from 'react-native-reanimated';
import { theme } from '../../theme/theme';

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: 'primary' | 'secondary';
    style?: ViewStyle;
    textStyle?: TextStyle;
    disabled?: boolean;
    loading?: boolean;
    testID?: string;
    accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    style,
    textStyle,
    disabled = false,
    loading = false,
    testID,
    accessibilityLabel,
}) => {
    const scale = useSharedValue(1);
    const shadowOpacity = useSharedValue(0.3);
    const shadowRadius = useSharedValue(8);
    const elevation = useSharedValue(5);
    
    // Derived state for effective disabled status
    const isEffectiveDisabled = disabled || loading;

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            shadowOpacity: shadowOpacity.value,
            shadowRadius: shadowRadius.value,
            elevation: elevation.value,
            opacity: isEffectiveDisabled ? 0.7 : 1,
        };
    });

    const handlePressIn = () => {
        if (isEffectiveDisabled) return;
        scale.value = withSpring(0.96, { damping: 10, stiffness: 300 });
        if (variant === 'primary') {
            shadowOpacity.value = withTiming(0.15, { duration: 150 });
            shadowRadius.value = withTiming(4, { duration: 150 });
            elevation.value = withTiming(2, { duration: 150 });
        }
    };

    const handlePressOut = () => {
        if (isEffectiveDisabled) return;
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
                style,
                animatedStyle
            ]}
            onPress={isEffectiveDisabled ? undefined : onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isEffectiveDisabled}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? 'white' : theme.colors.primary} />
            ) : (
                <Text style={[styles.text, variant === 'primary' && styles.primaryText, textStyle]}>
                    {title}
                </Text>
            )}
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: theme.spacing.xl,
        borderRadius: 50, // Pill shape
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 48, // Fixed height to prevent layout shift when switching to spinner
    },
    primaryContainer: {
        backgroundColor: theme.colors.primary,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
    },
    text: {
        fontSize: theme.typography.sizes.button,
        fontWeight: '600',
    },
    primaryText: {
        color: theme.colors.white,
    },
});
