import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import { Header } from '../components/layout/Header';
import { StatusPill } from '../components/common/StatusPill';
import { ProgressRing } from '../components/common/ProgressRing';
import { MetricCard } from '../components/common/MetricCard';
import { AlertCard } from '../components/common/AlertCard';
import { WeeklyStatCard } from '../components/common/WeeklyStatCard';
import { dashboardData } from '../constants/dashboardData';

import { useAuth } from '../context/AuthContext';

export const Dashboard: React.FC = () => {
    const { user: authUser, profile, loading: authLoading } = useAuth();
    
    // Fallback data if profile is loading or incomplete
    const userName = profile?.username || authUser?.user_metadata?.name || 'User';
    // Use company location address, or just "Remote" / "Not Set"
    const userLocation = profile?.company_location?.address || 'Location not set';
    // Status is currently hardcoded until we implement the attendance log system
    const userStatus = "Checked Out"; 

    // Destructure partial mock data for other sections (Compliance, Metrics etc.) 
    // We only replace the User Identity section for now.
    const { compliance, metrics, alert, weekly } = dashboardData;

    return (
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
                        <View>
                            <Text style={styles.greetingTitle}>Good Morning,</Text>
                            <Text style={styles.greetingName}>{userName}</Text>
                        </View>
                        <StatusPill status={userStatus} location={userLocation.split(',')[0]} />
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

                {/* Weekly Stat Section */}
                <Animated.View entering={FadeInDown.delay(350).duration(600).springify()}>
                    <View style={styles.section}>
                        <WeeklyStatCard {...dashboardData.weekly} />
                    </View>
                </Animated.View>

                {/* Alert Section */}
                <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
                    <View style={styles.section}>
                        <AlertCard {...alert} />
                    </View>
                </Animated.View>



            </ScrollView>

        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: 15,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 20,
    },
    greetingSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        marginTop: 4,
    },
    greetingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.text.secondary,
    },
    greetingName: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    section: {
        marginBottom: 16,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    metricWrapper: {
        flex: 1,
    }
});
