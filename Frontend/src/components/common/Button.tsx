import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../theme/theme';

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: 'primary' | 'secondary';
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button = React.forwardRef<React.ElementRef<typeof TouchableOpacity>, ButtonProps>(({
    title,
    onPress,
    variant = 'primary',
    style,
    textStyle
}, ref) => {
    return (
        <TouchableOpacity
            ref={ref}
            style={[styles.container, variant === 'primary' && styles.primaryContainer, style]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={[styles.text, variant === 'primary' && styles.primaryText, textStyle]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
});

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
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    text: {
        fontSize: theme.typography.sizes.button,
        fontWeight: '600',
    },
    primaryText: {
        color: theme.colors.white,
    },
});
