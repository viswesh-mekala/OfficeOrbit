import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';
import { router, usePathname } from 'expo-router';
import { moderateScale, scaledFont } from '../../utils/responsive';

export const BottomTabs: React.FC = () => {
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    // Dynamic bottom padding: actual device inset (handles 3-button nav, gesture nav, notch)
    // Minimum 8px so tabs aren't flush against the edge on gesture-nav devices
    const bottomPad = Math.max(insets.bottom, 8);

    const tabs = [
        { name: 'Dashboard', icon: 'grid', route: '/dashboard' },
        { name: 'Attendance', icon: 'calendar', route: '/attendance' },
        { name: 'Subscription', icon: 'diamond', route: '/subscription' }, // Sparkles/Premium Ribbon
        { name: 'Team', icon: 'people', route: '/team' },
        { name: 'Profile', icon: 'person', route: '/profile' },
    ];

    return (
        <View style={[styles.container, { paddingBottom: bottomPad }]}>
            {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.route);
                return (
                    <TouchableOpacity
                        key={tab.name}
                        style={styles.tab}
                    onPress={() => {
                        // MNC pattern: tab switches REPLACE the current screen (never push).
                        // This means the back button on any tab goes straight to "exit app"
                        // rather than cycling through previously visited tabs (Instagram/Slack).
                        if (!isActive) router.replace(tab.route as any);
                        // If already on this tab — do nothing (tapping current tab is a no-op)
                    }}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={isActive ? tab.icon as any : `${tab.icon}-outline` as any}
                            size={moderateScale(22)}
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
        paddingTop: moderateScale(10),
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        // paddingBottom is dynamic via insets — applied inline
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    label: {
        fontSize: scaledFont(10),
        color: theme.colors.text.secondary,
        fontWeight: '500',
    },
    activeLabel: {
        color: theme.colors.primary,
        fontWeight: '700',
    }
});
