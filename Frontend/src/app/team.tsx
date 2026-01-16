import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MainLayout } from '../components/layout/MainLayout';
import { theme } from '../theme/theme';

export default function Team() {
    return (
        <MainLayout>
            <View style={styles.container}>
                <Text style={styles.title}>Team</Text>
            </View>
        </MainLayout>
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
