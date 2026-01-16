import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { Header } from '../components/layout/Header';
import { BottomTabs } from '../components/layout/BottomTabs';
import { StatusPill } from '../components/common/StatusPill';
import { ProgressRing } from '../components/common/ProgressRing';
import { MetricCard } from '../components/common/MetricCard';
import { AlertCard } from '../components/common/AlertCard';
import { dashboardData } from '../constants/dashboardData';

export const Dashboard: React.FC = () => {
    const { user, compliance, metrics, alert } = dashboardData;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                <Header />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Greeting Section */}
                    <View style={styles.greetingSection}>
                        <Text style={styles.greetingTitle}>Good Morning,</Text>
                        <Text style={styles.greetingName}>{user.name}</Text>

                        <View style={styles.statusContainer}>
                            <StatusPill status={user.status} location={user.location} />
                        </View>
                    </View>

                    {/* Compliance Section */}
                    <View style={styles.section}>
                        <ProgressRing
                            percent={compliance.percent}
                            currentDays={compliance.currentDays}
                            totalDays={compliance.totalDays}
                            status={compliance.status}
                        />
                    </View>

                    {/* Metrics Grid */}
                    <View style={styles.metricsRow}>
                        {metrics.map((metric, index) => (
                            <View key={index} style={styles.metricWrapper}>
                                <MetricCard {...metric} icon={metric.icon as any} />
                            </View>
                        ))}
                    </View>

                    {/* Alert Section */}
                    <View style={styles.section}>
                        <AlertCard {...alert} />
                    </View>

                </ScrollView>

                <BottomTabs />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FAFAFA', // Light grey bg
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.l,
        paddingBottom: 100, // Space for bottom tabs
    },
    greetingSection: {
        marginBottom: theme.spacing.xl,
    },
    greetingTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    greetingName: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
    },
    statusContainer: {
        marginTop: 4,
    },
    section: {
        marginBottom: theme.spacing.l,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: theme.spacing.m,
        marginBottom: theme.spacing.l,
    },
    metricWrapper: {
        flex: 1,
    }
});
