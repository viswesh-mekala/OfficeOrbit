import React from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../../theme/theme';
import { BottomTabs } from './BottomTabs';

interface BottomLayoutProps {
    children: React.ReactNode;
    /** Set true on screens with text inputs (Profile edit, etc.) */
    withKeyboard?: boolean;
}

export const BottomLayout: React.FC<BottomLayoutProps> = ({ children, withKeyboard }) => {
    const content = (
        <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(400)}>
            <View style={{ flex: 1 }}>
                {children}
            </View>
        </Animated.View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />
            <View style={styles.content}>
                {withKeyboard ? (
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        {content}
                    </KeyboardAvoidingView>
                ) : (
                    content
                )}
            </View>
            <BottomTabs />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
});
