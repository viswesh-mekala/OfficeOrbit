import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
                {/* Header with Animation */}
                <Animated.View entering={FadeInDown.duration(600).springify()}>
                    <Header />
                </Animated.View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Greeting Section */}
                    <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
                        <View style={styles.greetingSection}>
                            <Text style={styles.greetingTitle}>Good Morning,</Text>
                            <Text style={styles.greetingName}>{user.name}</Text>

                            <View style={styles.statusContainer}>
                                <StatusPill status={user.status} location={user.location} />
                            </View>
                        </View>
                    </Animated.View>

                    {/* Compliance Section */}
                    <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
                        <View style={styles.section}>
                            <ProgressRing
                                percent={compliance.percent}
                                currentDays={compliance.currentDays}
                                totalDays={compliance.totalDays}
                                status={compliance.status}
                            />
                        </View>
                    </Animated.View>

                    {/* Metrics Grid */}
                    <Animated.View entering={FadeInDown.delay(300).duration(600).springify()}>
                        <View style={styles.metricsRow}>
                            {metrics.map((metric, index) => (
                                <View key={index} style={styles.metricWrapper}>
                                    <MetricCard {...metric} icon={metric.icon as any} />
                                </View>
                            ))}
                        </View>
                    </Animated.View>

                    {/* Alert Section */}
                    <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
                        <View style={styles.section}>
                            <AlertCard {...alert} />
                        </View>
                    </Animated.View>

                </ScrollView>

                <BottomTabs />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.background, // Using theme background (Light Blue/White)
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
