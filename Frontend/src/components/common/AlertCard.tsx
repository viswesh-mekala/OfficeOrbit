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
                <Ionicons name="warning" size={16} color="#FF9800" />
                <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.message}>{message}</Text>
            {action ? (
                <TouchableOpacity>
                    <Text style={styles.action}>{action}</Text>
                </TouchableOpacity>
            ) : null}
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFF9E6', // Light orange background for alert
        borderWidth: 1,
        borderColor: '#FFE082',
        padding: 10, // Aggressively reduced padding
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4, // Tighter
        gap: 6,
    },
    title: {
        fontSize: 14, // Smaller title
        fontWeight: '700',
        color: '#D84315',
    },
    message: {
        fontSize: 12, // Smaller message
        color: theme.colors.text.primary,
        lineHeight: 16,
    },
    action: {
        fontSize: 14,
        fontWeight: '600',
        color: '#D84315',
        textDecorationLine: 'underline',
    },
});
