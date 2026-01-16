import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { router, usePathname } from 'expo-router';

export const BottomTabs: React.FC = () => {
    const pathname = usePathname();

    // Simple state checking for active tab based on pathname
    // Note: pathname might be /dashboard, /attendance, etc.

    const tabs = [
        { name: 'Dashboard', icon: 'grid', route: '/dashboard' },
        { name: 'Attendance ', icon: 'calendar', route: '/attendance' }, // Mapping attendance to schedule
        { name: 'Team', icon: 'people', route: '/team' }, // Mapping reports to team for demo
        { name: 'Profile', icon: 'person', route: '/profile' },
    ];

    return (
        <View style={styles.container}>
            {tabs.map((tab) => {
                const isActive = pathname.includes(tab.route);
                return (
                    <TouchableOpacity
                        key={tab.name}
                        style={styles.tab}
                        onPress={() => router.push(tab.route as any)}
                    >
                        <Ionicons
                            name={isActive ? tab.icon as any : `${tab.icon}-outline` as any}
                            size={24}
                            color={isActive ? theme.colors.primary : theme.colors.text.secondary}
                        />
                        <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.name}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingBottom: 20, // Safe area padding simulation
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    label: {
        fontSize: 10,
        color: theme.colors.text.secondary,
        fontWeight: '500',
    },
    activeLabel: {
        color: theme.colors.primary,
        fontWeight: '700',
    }
});
