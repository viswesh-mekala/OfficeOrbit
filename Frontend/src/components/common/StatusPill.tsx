import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

interface StatusPillProps {
    status: string;
    location: string;
    variant?: 'wfo' | 'wfh' | 'holiday' | 'leave' | 'absent';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, location, variant = 'wfo' }) => {
    const getStatusColor = () => {
        switch (variant) {
            case 'wfo': return theme.colors.success;
            case 'wfh': return theme.colors.primary; // Purple for WFH
            case 'holiday': return theme.colors.error;
            case 'leave': return theme.colors.warning;
            default: return theme.colors.text.secondary;
        }
    };

    const color = getStatusColor();

    return (
        <View style={styles.container}>
            <View style={[styles.indicator, { backgroundColor: color }]} />
            <View>
                <Text style={styles.status}>{status}</Text>
                <Text style={styles.location}>{location}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.white,
        paddingVertical: theme.spacing.s,
        paddingHorizontal: theme.spacing.m,
        borderRadius: 50,
        alignSelf: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    indicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: theme.spacing.s,
    },
    status: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    location: {
        fontSize: 10,
        color: theme.colors.text.secondary,
    },
});
