import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';
import { Header } from '../../components/layout/Header';
import { StatusPill } from '../../components/common/StatusPill';
import { ProgressRing } from '../../components/common/ProgressRing';
import { MetricCard } from '../../components/common/MetricCard';
import { AlertCard } from '../../components/common/AlertCard';
import { WeeklyStatCard } from '../../components/common/WeeklyStatCard';

import { useAuth } from '../../store/AuthContext';

import { RefreshControl, Alert } from 'react-native';
import * as Location from 'expo-location';
import { useAttendance } from '../../hooks/useAttendance';
import { SlideAction } from '../../components/common/SlideAction';
import { clockIn, clockOut } from '../../services/AttendanceService';
import { getDistanceFromLatLonInMeters } from '../../utils/locationUtils';

export const Dashboard: React.FC = () => {
    const { user: authUser, profile, loading: authLoading } = useAuth();
    const { todayLog, weeklyLogs, loading: attendanceLoading, refresh, refreshing } = useAttendance();
    
    // Fallback data
    const userName = profile?.username || authUser?.user_metadata?.name || 'User';
    
    // Time-aware greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning,';
        if (hour < 17) return 'Good Afternoon,';
        return 'Good Evening,';
    };
    
    // Logic for Status Pill
    let statusText = "Not Checked In";
    let locationText = "Unknown";
    let statusVariant: 'wfo' | 'wfh' | 'holiday' | 'leave' | 'absent' = 'absent';

    const isWfh = todayLog?.status === 'wfh';
    const isPresent = todayLog?.status === 'present';
    const isHoliday = todayLog?.status === 'holiday';
    const isLeave = todayLog?.status === 'leave';

    if (todayLog) {
        if (todayLog.check_out) {
            statusText = "Checked Out";
        } else if (todayLog.check_in) {
            statusText = "Checked In";
        } else {
            statusText = todayLog.status === 'holiday' ? "Holiday" : "On Leave";
        }

        if (isWfh) {
            statusVariant = 'wfh';
            locationText = "Work From Home";
        } else if (isPresent) {
            statusVariant = 'wfo';
            locationText = todayLog.location_check_in?.address || "Office";
        } else if (isHoliday) {
            statusVariant = 'holiday';
            locationText = "Home";
        } else if (isLeave) {
            statusVariant = 'leave';
            locationText = "Home";
        }
    } else {
        const day = new Date().getDay();
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) {
            statusText = "Weekend";
            statusVariant = 'holiday'; 
            locationText = "Enjoy your day off";
        } else {
            statusText = "Not Checked In";
            statusVariant = 'absent';
            locationText = profile?.company_location?.address?.split(',')[0] || "Ready to start?";
        }
    }

    const handleSwipeAction = async () => {
        if (!authUser?.id) return;

        // CASE 1: Check Out (if already checked in and not checked out)
        if (todayLog && !todayLog.check_out) {
            const { error } = await clockOut();
            if (error) {
                Alert.alert("Error", error.message || "Failed to check out.");
            } else {
                refresh();
                Alert.alert("Success", "Checked out successfully! 👋");
            }
            return;
        }

        // CASE 2: Check In
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission", "Location access is needed to check in.");
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            
            // Validate Distance if Profile has location
            if (profile?.company_location) {
                const dist = getDistanceFromLatLonInMeters(
                    location.coords.latitude, 
                    location.coords.longitude,
                    profile.company_location.latitude,
                    profile.company_location.longitude
                );

                if (dist <= 500) {
                    // At Office
                    const { error } = await clockIn('present', {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        address: 'Office (Manual Swipe)'
                    });

                    if (error) {
                         Alert.alert("Check-In Failed", error.message);
                    } else {
                        refresh();
                        Alert.alert("Welcome!", "Checked in at Office 🏢");
                    }
                } else {
                    // Far from office
                    Alert.alert(
                        "Not at Office",
                        "You seem to be far from the office location. Mark as Work From Home?",
                        [
                            { text: "Cancel", style: "cancel" },
                            { 
                                text: "Mark WFH", 
                                onPress: async () => {
                                    const { error } = await clockIn('wfh', {
                                        latitude: location.coords.latitude,
                                        longitude: location.coords.longitude,
                                        address: 'Remote'
                                    });
                                    if (error) {
                                         Alert.alert("Error", error.message);
                                    } else {
                                        refresh();
                                    }
                                } 
                            }
                        ]
                    );
                }
            } else {
                // No company location set — allow checkin with warning
                Alert.alert(
                    "No Office Location Set",
                    "You haven't set your office location yet. Check in as Work From Home?",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Check In as WFH",
                            onPress: async () => {
                                const { error } = await clockIn('wfh', {
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude,
                                    address: 'Remote (No Office Set)'
                                });
                                if (error) {
                                    Alert.alert("Error", error.message);
                                } else {
                                    refresh();
                                }
                            }
                        }
                    ]
                );
            }

        } catch (error) {
            Alert.alert("Error", "Could not verify location.");
        }
    };

    // ── Compute real dashboard metrics from attendance data ──
    const dashboardMetrics = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();

        // Business days elapsed this month (Mon–Fri)
        let businessDaysElapsed = 0;
        for (let d = 1; d <= currentDay; d++) {
            const day = new Date(currentYear, currentMonth, d).getDay();
            if (day !== 0 && day !== 6) businessDaysElapsed++;
        }

        // Total business days in this month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        let totalBusinessDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const day = new Date(currentYear, currentMonth, d).getDay();
            if (day !== 0 && day !== 6) totalBusinessDays++;
        }

        // Days logged (present or WFH) this month
        const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const monthLogs = weeklyLogs.filter(l =>
            l.date.startsWith(monthStr) && (l.status === 'present' || l.status === 'wfh')
        );
        const officeDays = monthLogs.length;
        const compliancePercent = businessDaysElapsed > 0
            ? Math.round((officeDays / businessDaysElapsed) * 100)
            : 0;

        // Weekly stat (current week, Mon–Sun)
        const dayOfWeek = now.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(currentYear, currentMonth, currentDay - mondayOffset);
        const weekDates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            weekDates.push(d.toISOString().split('T')[0]);
        }
        const weekLogs = weeklyLogs.filter(l => weekDates.includes(l.date) && (l.status === 'present' || l.status === 'wfh'));
        const weekWorkdays = weekDates.filter(d => {
            const day = new Date(d).getDay();
            return day !== 0 && day !== 6;
        }).length;
        const weekPercent = weekWorkdays > 0 ? Math.round((weekLogs.length / weekWorkdays) * 100) : 0;

        // Current streak — consecutive attendance days (working backwards from today)
        let streak = 0;
        const sortedDates = weeklyLogs
            .filter(l => l.status === 'present' || l.status === 'wfh')
            .map(l => l.date)
            .sort()
            .reverse();

        let checkDate = new Date(currentYear, currentMonth, currentDay);
        for (const dateStr of sortedDates) {
            // Skip weekends when counting streak
            while (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
                checkDate.setDate(checkDate.getDate() - 1);
            }
            const expected = checkDate.toISOString().split('T')[0];
            if (dateStr === expected) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (dateStr < expected) {
                break;
            }
        }

        // Compliance status
        let complianceStatus = 'On Track';
        if (compliancePercent < 50) complianceStatus = 'Needs Attention';
        else if (compliancePercent < 70) complianceStatus = 'Almost There';

        // Alert
        const remainingWorkdays = weekWorkdays - weekLogs.length;
        const needsMore = remainingWorkdays > 0 && weekPercent < 80;

        return {
            compliance: {
                percent: Math.min(compliancePercent, 100),
                currentDays: officeDays,
                totalDays: businessDaysElapsed,
                status: complianceStatus,
            },
            weekly: {
                percent: Math.min(weekPercent, 100),
                label: 'This Week',
                subtext: `${weekLogs.length}/${weekWorkdays} Days`,
            },
            metrics: [
                { title: 'Current Streak', value: String(streak), subtext: 'Days', icon: 'flame' as const, color: '#FF9800' },
                { title: 'This Month', value: String(officeDays), subtext: `of ${businessDaysElapsed} workdays`, icon: 'calendar' as const },
            ],
            alert: needsMore
                ? { title: 'Gap Detected', message: `You need ${remainingWorkdays} more day${remainingWorkdays > 1 ? 's' : ''} this week to stay on track.`, action: '' }
                : { title: 'Looking Good! 🎉', message: `You're on track this week.`, action: '' },
        };
    }, [weeklyLogs]);

    return (
        <View style={styles.container}>
            {/* Header with Animation */}
            <Animated.View entering={FadeInDown.duration(600).springify()}>
                <Header />
            </Animated.View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary]} />
                }
            >
                {/* Greeting Section */}
                <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
                    <View style={styles.greetingSection}>
                        <View>
                            <Text style={styles.greetingTitle}>{getGreeting()}</Text>
                            <Text style={styles.greetingName}>{userName}</Text>
                        </View>
                        <StatusPill 
                            status={statusText} 
                            location={locationText} 
                            variant={statusVariant}
                        />
                    </View>
                </Animated.View>

                {/* Swipe Action Section */}
                <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.section}>
                    {(!todayLog || (todayLog && !todayLog.check_out)) ? ( // Show if not checked out yet
                         <SlideAction
                            label={todayLog ? "Slide to Check Out" : "Slide to Check In"}
                            icon={todayLog ? "log-out-outline" : "log-in-outline"}
                            color={todayLog ? theme.colors.warning : theme.colors.success}
                            onSwipeSuccess={handleSwipeAction}
                            disabled={todayLog?.status === 'holiday' || todayLog?.status === 'leave'} // Disable check-in on holidays
                        />
                    ) : (
                         <View style={styles.shiftComplete}>
                             <Text style={styles.shiftCompleteText}>Shift Complete ✅</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Compliance Section */}
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
                    <View style={styles.section}>
                        <ProgressRing
                            percent={dashboardMetrics.compliance.percent}
                            currentDays={dashboardMetrics.compliance.currentDays}
                            totalDays={dashboardMetrics.compliance.totalDays}
                            status={dashboardMetrics.compliance.status}
                        />
                    </View>
                </Animated.View>

                {/* Metrics Grid */}
                <Animated.View entering={FadeInDown.delay(300).duration(600).springify()}>
                    <View style={styles.metricsRow}>
                        {dashboardMetrics.metrics.map((metric, index) => (
                            <View key={index} style={styles.metricWrapper}>
                                <MetricCard {...metric} icon={metric.icon as any} />
                            </View>
                        ))}
                    </View>
                </Animated.View>

                {/* Weekly Stat Section */}
                <Animated.View entering={FadeInDown.delay(350).duration(600).springify()}>
                    <View style={styles.section}>
                        <WeeklyStatCard {...dashboardMetrics.weekly} />
                    </View>
                </Animated.View>

                {/* Alert Section */}
                <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
                    <View style={styles.section}>
                        <AlertCard {...dashboardMetrics.alert} />
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
    },
    shiftComplete: {
        width: '100%',
        height: 80, // Matches SlideAction container
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 40,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    shiftCompleteText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.secondary,
        letterSpacing: 0.5,
    }
});
