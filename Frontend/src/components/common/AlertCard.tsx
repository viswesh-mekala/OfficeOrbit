import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { theme } from '../../theme/theme';

interface AlertCardProps {
    title: string;
    message: string;
    action: string;
}

export const AlertCard: React.FC<AlertCardProps> = ({ title, message, action }) => {
    return (
        <Card style={styles.card}>
            <View style={styles.header}>
                <Ionicons name="warning" size={20} color="#FF9800" />
                <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity>
                <Text style={styles.action}>{action}</Text>
            </TouchableOpacity>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF9E6', // Light orange background for alert
        borderWidth: 1,
        borderColor: '#FFE082',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#D84315',
    },
    message: {
        fontSize: 14,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
        lineHeight: 20,
    },
    action: {
        fontSize: 14,
        fontWeight: '600',
        color: '#D84315',
        textDecorationLine: 'underline',
    },
});
