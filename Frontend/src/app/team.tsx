import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomLayout } from '../components/layout/BottomLayout';
import { theme } from '../theme/theme';

export default function Team() {
    return (
        <BottomLayout>
            <View style={styles.container}>
                <Text style={styles.title}>Team</Text>
            </View>
        </BottomLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: theme.spacing.m,
    },
    title: {
        fontSize: theme.typography.sizes.title,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
    },
});
