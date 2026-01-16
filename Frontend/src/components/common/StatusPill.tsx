import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

interface StatusPillProps {
    status: string;
    location: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, location }) => {
    return (
        <View style={styles.container}>
            <View style={styles.indicator} />
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
        backgroundColor: theme.colors.success,
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
