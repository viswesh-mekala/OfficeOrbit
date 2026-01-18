import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text } from 'react-native';
import { theme } from '../../theme/theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    error ? styles.inputError : null,
                    style
                ]}
                placeholderTextColor={theme.colors.text.secondary}
                {...props}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.m,
        width: '100%',
    },
    label: {
        fontSize: 14,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.s,
        fontWeight: '500',
    },
    input: {
        backgroundColor: theme.colors.white,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: theme.spacing.m,
        fontSize: 16,
        color: theme.colors.text.primary,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    inputError: {
        borderColor: '#FF4444',
    },
    errorText: {
        fontSize: 12,
        color: '#FF4444',
        marginTop: 4,
        marginLeft: 4,
    },
});
