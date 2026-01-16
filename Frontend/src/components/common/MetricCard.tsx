import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { theme } from '../../theme/theme';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon?: keyof typeof Ionicons.glyphMap;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, icon }) => {
    return (
        <Card style={styles.card}>
            <View style={styles.iconContainer}>
                {icon && <Ionicons name={icon} size={20} color={theme.colors.primary} />}
            </View>
            <Text style={styles.value}>
                {value} <Text style={styles.subtext}>{subtext}</Text>
            </Text>
            <Text style={styles.title}>{title}</Text>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: theme.spacing.m,
        alignItems: 'flex-start',
        flex: 1, // Allow to grow in grid
    },
    iconContainer: {
        backgroundColor: '#F0F4FF',
        padding: 8,
        borderRadius: 50,
        marginBottom: theme.spacing.s,
    },
    value: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    subtext: {
        fontSize: 14,
        fontWeight: '400',
        color: theme.colors.text.secondary,
    },
    title: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        marginTop: 4,
    },
});
