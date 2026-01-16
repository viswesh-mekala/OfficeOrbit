import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../../theme/theme';
import { BottomTabs } from './BottomTabs';

interface BottomLayoutProps {
    children: React.ReactNode;
}

export const BottomLayout: React.FC<BottomLayoutProps> = ({ children }) => {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />
            <View style={styles.content}>
                <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(400)}>
                    {/* Standard flex container, no special padding needed for floating absolute items */}
                    <View style={{ flex: 1 }}>
                        {children}
                    </View>
                </Animated.View>
            </View>
            <BottomTabs />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Clean white
    },
    content: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
});
