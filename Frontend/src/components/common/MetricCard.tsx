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
    color?: string; // New optional color prop
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, icon, color }) => {
    const activeColor = color || theme.colors.primary;
    // Simple way to make a light background: use opacity or a predefined light map. 
    // For now, let's keep the background generic or slightly tinted if possible, 
    // but just changing the foreground is the main request.

    return (
        <Card style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: color ? `${color}15` : '#F0F4FF' }]}>
                {icon && <Ionicons name={icon} size={20} color={activeColor} />}
            </View>
            <Text style={[styles.value, { color: activeColor }]}>
                {value} <Text style={styles.subtext}>{subtext}</Text>
            </Text>
            <Text style={styles.title}>{title}</Text>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 12, // Reduced padding
        alignItems: 'flex-start',
        flex: 1, // Allow to grow in grid
    },
    iconContainer: {
        backgroundColor: '#F0F4FF',
        padding: 6, // Reduced padding
        borderRadius: 50,
        marginBottom: 6,
    },
    value: {
        fontSize: 22, // Reduced font
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    subtext: {
        fontSize: 12,
        fontWeight: '400',
        color: theme.colors.text.secondary,
    },
    title: {
        fontSize: 12,
        color: theme.colors.text.secondary,
        marginTop: 2,
    },
});
