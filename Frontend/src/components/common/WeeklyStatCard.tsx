import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { theme } from '../../theme/theme';

interface WeeklyStatCardProps {
    percent: number;
    label: string;
    subtext: string;
}

export const WeeklyStatCard: React.FC<WeeklyStatCardProps> = ({ percent, label, subtext }) => {
    return (
        <Card style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.percent}>{percent}%</Text>
            </View>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.subtext}>{subtext}</Text>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 10, // Aggressively reduced padding
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4, // Tighter
    },
    label: {
        fontSize: 12, // Smaller label
        fontWeight: '600',
        color: theme.colors.text.secondary,
    },
    percent: {
        fontSize: 18, // Smaller percent
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    progressBarBg: {
        height: 6, // Thinner bar
        backgroundColor: '#F0F4FF',
        borderRadius: 3,
        marginBottom: 4, // Tighter
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 3,
    },
    subtext: {
        fontSize: 10, // Smaller subtext
        color: theme.colors.text.secondary,
        textAlign: 'right',
    },
});
