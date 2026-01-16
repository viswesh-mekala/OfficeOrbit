import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';

export const Header: React.FC = () => {
    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                    <Ionicons name="infinite" size={20} color="white" />
                </View>
                <Text style={styles.logoText}>Orbit</Text>
            </View>
            <TouchableOpacity>
                <Ionicons name="notifications" size={24} color={theme.colors.text.secondary} />
                <View style={styles.notificationDot} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.l,
        paddingVertical: theme.spacing.s,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    logoCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    notificationDot: {
        position: 'absolute',
        top: 0,
        right: 2,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'red',
        borderWidth: 1,
        borderColor: 'white',
    }
});
