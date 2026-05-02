import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
import { addNotification } from '../../services/NotificationService';
import {
  isCalendarManagedDay,
  liveDurationMinutes,
} from '../../utils/attendancePolicy';

export const Dashboard: React.FC = () => {
  const { user: authUser, profile, loading: authLoading } = useAuth();
  const {
    todayLog,
    weeklyLogs,
    loading: attendanceLoading,
    refresh,
    refreshing,
  } = useAttendance();
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);

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
  let statusText = 'Not Checked In';
  let locationText = 'Unknown';
  let statusVariant: 'wfo' | 'wfh' | 'holiday' | 'leave' | 'absent' = 'absent';

  const isWfh = todayLog?.status === 'wfh';
  const isPresent = todayLog?.status === 'present';
  const isHoliday = todayLog?.status === 'holiday';
  const isLeave = todayLog?.status === 'leave';
  const calendarManagedToday = isCalendarManagedDay(todayLog);

  if (todayLog) {
    if (todayLog.check_out) {
      statusText = 'Checked Out';
    } else if (todayLog.check_in) {
      statusText = 'Checked In';
    } else {
      if (calendarManagedToday) {
        statusText =
          todayLog.status === 'present'
            ? 'Office'
            : todayLog.status === 'wfh'
              ? 'Home'
              : todayLog.status === 'holiday'
                ? 'Holiday'
                : todayLog.status === 'leave'
                  ? 'On Leave'
                  : 'Day updated';
      } else {
        statusText = todayLog.status === 'holiday' ? 'Holiday' : 'On Leave';
      }
    }

    if (isWfh) {
      statusVariant = 'wfh';
      locationText = 'Work From Home';
    } else if (isPresent) {
      statusVariant = 'wfo';
      locationText = todayLog.location_check_in?.address || 'Office';
    } else if (isHoliday) {
      statusVariant = 'holiday';
      locationText = 'Home';
    } else if (isLeave) {
      statusVariant = 'leave';
      locationText = 'Home';
    }
  } else {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      statusText = 'Weekend';
      statusVariant = 'holiday';
      locationText = 'Enjoy your day off';
    } else {
      statusText = 'Not Checked In';
      statusVariant = 'absent';
      locationText =
        profile?.company_location?.address?.split(',')[0] || 'Ready to start?';
    }
  }

  const handleSwipeAction = async () => {
    if (!authUser?.id || isSubmittingAttendance) return;

    setIsSubmittingAttendance(true);

    if (calendarManagedToday) {
      Alert.alert(
        'Attendance already set',
        'This day has a status without check-in/out times. Update it from Attendance, or clear it before using swipe check-in/out.',
      );
      setIsSubmittingAttendance(false);
      return;
    }

    // CASE 1: Check Out (if already checked in and not checked out)
    try {
      if (todayLog && !todayLog.check_out) {
        const { error } = await clockOut();
        if (error) {
          await addNotification({
            title: 'Check-out failed',
            body:
              error.message || 'We could not check you out. Please try again.',
            type: 'attendance',
          });
          Alert.alert('Error', error.message || 'Failed to check out.');
        } else {
          refresh();
          await addNotification({
            title: 'Checked out successfully',
            body: 'Your attendance has been marked for today.',
            type: 'attendance',
          });
          Alert.alert('Success', 'Checked out successfully! 👋');
        }
        return;
      }

      // CASE 2: Check In
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await addNotification({
          title: 'Location permission required',
          body: 'Enable location access to continue check-in.',
          type: 'location',
        });
        Alert.alert('Permission', 'Location access is needed to check in.');
        return;
      }

      const quickLocation = await Location.getLastKnownPositionAsync({
        maxAge: 120000, // Use cached location up to 2 minutes old for faster response
        requiredAccuracy: 150,
      });
      const location =
        quickLocation ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      // Validate Distance if Profile has location
      if (profile?.company_location) {
        const dist = getDistanceFromLatLonInMeters(
          location.coords.latitude,
          location.coords.longitude,
          profile.company_location.latitude,
          profile.company_location.longitude,
        );

        if (dist <= 500) {
          // At Office
          const { error } = await clockIn('present', {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            address: 'Office (Manual Swipe)',
          });

          if (error) {
            await addNotification({
              title: 'Check-in failed',
              body: error.message || 'We could not check you in at office.',
              type: 'attendance',
            });
            Alert.alert('Check-In Failed', error.message);
          } else {
            refresh();
            await addNotification({
              title: 'Checked in at office',
              body: 'Attendance marked successfully. Have a productive day!',
              type: 'attendance',
            });
            Alert.alert('Welcome!', 'Checked in at Office 🏢');
          }
        } else {
          // Far from office
          Alert.alert(
            'Away From Office Location',
            'You are outside the office boundary. Do you want to continue and mark attendance as Work From Home?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Mark WFH',
                onPress: async () => {
                  const { error } = await clockIn('wfh', {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    address: 'Remote',
                  });
                  if (error) {
                    await addNotification({
                      title: 'WFH check-in failed',
                      body: error.message || 'Unable to mark Work From Home.',
                      type: 'attendance',
                    });
                    Alert.alert('Error', error.message);
                  } else {
                    refresh();
                    await addNotification({
                      title: 'Marked as Work From Home',
                      body: 'You were away from office location during check-in.',
                      type: 'location',
                    });
                    Alert.alert('Done', 'Marked as Work From Home.');
                  }
                },
              },
            ],
          );
        }
      } else {
        // No company location set — allow checkin with warning
        Alert.alert(
          'No Office Location Set',
          "You haven't set your office location yet. Check in as Work From Home?",
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Check In as WFH',
              onPress: async () => {
                const { error } = await clockIn('wfh', {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  address: 'Remote (No Office Set)',
                });
                if (error) {
                  await addNotification({
                    title: 'WFH check-in failed',
                    body: error.message || 'Unable to check in right now.',
                    type: 'attendance',
                  });
                  Alert.alert('Error', error.message);
                } else {
                  refresh();
                  await addNotification({
                    title: 'Checked in as Work From Home',
                    body: 'No office location is set on your profile yet.',
                    type: 'system',
                  });
                }
              },
            },
          ],
        );
      }
    } catch (error) {
      await addNotification({
        title: 'Location verification failed',
        body: 'Could not verify your location while checking attendance.',
        type: 'location',
      });
      Alert.alert('Error', 'Could not verify location.');
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const openShiftMinutes = liveDurationMinutes(todayLog);

  // ── Compute real dashboard metrics from attendance data ──
  const dashboardMetrics = useMemo(() => {
    /**
     * Attendance "percentages" shown on this screen are **office share among worked modes**:
     *
     * - Numerator: days with `status === 'present'` (office / WFO check-ins represented as `present`)
     * - Denominator: days with `status === 'present' OR 'wfh'` (office + home), i.e. "working modes"
     *
     * Explicitly excluded from numerator/denominator:
     * - `leave`, `holiday`, `absent`, etc.
     *
     * Important nuances:
     * - This does **not** mean "weekdays only". If someone marks Sat/Sun as present/wfh, it will count.
     * - Open shifts (`check_out === null`) still count as long as the saved row is `present/wfh`
     *   (calendar coloring counts status too).
     */
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

    // Logs considered "worked" this month: office + home only (excludes leave/holiday/etc.)
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthLogs = weeklyLogs.filter(
      (l) =>
        l.date.startsWith(monthStr) &&
        (l.status === 'present' || l.status === 'wfh'),
    );
    const officeDays = monthLogs.filter((l) => l.status === 'present').length;
    const homeDays = monthLogs.filter((l) => l.status === 'wfh').length;
    const workedDays = officeDays + homeDays;

    // Office ratio among worked modes this month: office / (office + home)
    const monthCompliancePercent =
      workedDays > 0 ? Math.round((officeDays / workedDays) * 100) : 0;

    // Weekly office ratio uses the same definition as monthly, but scoped to the current Mon–Sun window.
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(
      currentYear,
      currentMonth,
      currentDay - mondayOffset,
    );
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }
    const weekLogs = weeklyLogs.filter(
      (l) =>
        weekDates.includes(l.date) &&
        (l.status === 'present' || l.status === 'wfh'),
    );
    const weekOfficeDays = weekLogs.filter(
      (l) => l.status === 'present',
    ).length;
    const weekHomeDays = weekLogs.filter((l) => l.status === 'wfh').length;
    const weekWorkedDays = weekOfficeDays + weekHomeDays;
    const weekWorkdays = weekDates.filter((d) => {
      const day = new Date(d).getDay();
      return day !== 0 && day !== 6;
    }).length;
    const weekPercent =
      weekWorkedDays > 0
        ? Math.round((weekOfficeDays / weekWorkedDays) * 100)
        : 0;

    /**
     * Compare current office-share vs the user's configured office-day target.
     *
     * Required office-share proxy:
     * - Read target days from `office_days_target` (fallback: legacy `wfh_days` migration field name)
     * - Interpret target over `office_target_period` (fallback: legacy `wfh_period`)
     * - Required % ~= targetOfficeDays / businessDaysInSelectedWindow (Mon–Fri count)
     *
     * Then compare delta points vs required:
     * - delta <= 0: On Track
     * - delta in (-10, 0): Needs Attention (orange)
     * - delta <= -10: Serious Attention (red)
     * - delta >= +20: Perfect (gold)
     *
     * Window selection:
     * - If period is `week`, compare against **current week Mon–Sun** ratio (matches Weekly card).
     * - If period is `month`, compare against **month-to-date** ratio (matches monthly ring inputs).
     */
    const targetPeriod =
      profile?.office_target_period || profile?.wfh_period || 'week';
    const rawTargetDays =
      profile?.office_days_target != null
        ? profile.office_days_target
        : profile?.wfh_days != null
          ? profile.wfh_days
          : 0;

    const businessDaysWeekWindow = weekDates.filter((d) => {
      const day = new Date(d).getDay();
      return day !== 0 && day !== 6;
    }).length;

    let businessDaysMonthToDate = 0;
    for (let d = 1; d <= currentDay; d++) {
      const day = new Date(currentYear, currentMonth, d).getDay();
      if (day !== 0 && day !== 6) businessDaysMonthToDate++;
    }

    const businessDaysInTargetWindow =
      targetPeriod === 'month' ? businessDaysMonthToDate : businessDaysWeekWindow;

    const clampedTargetDays =
      rawTargetDays > 0
        ? Math.min(rawTargetDays, Math.max(1, businessDaysInTargetWindow))
        : 0;

    const requiredPercent =
      clampedTargetDays > 0 && businessDaysInTargetWindow > 0
        ? Math.min(
            100,
            Math.round((clampedTargetDays / businessDaysInTargetWindow) * 100),
          )
        : null;

    const trackedPercent =
      targetPeriod === 'month' ? monthCompliancePercent : weekPercent;

    const deltaPoints =
      requiredPercent == null
        ? null
        : Math.round(trackedPercent - requiredPercent);

    let complianceStatus = 'Set office target';
    let complianceSeverity: 'perfect' | 'good' | 'warn' | 'bad' | 'neutral' =
      'neutral';

    if (deltaPoints == null || rawTargetDays <= 0) {
      complianceStatus = 'Set office target';
      complianceSeverity = 'neutral';
    } else if (trackedPercent >= 100 && deltaPoints >= 20) {
      complianceStatus = 'Perfect';
      complianceSeverity = 'perfect';
    } else if (deltaPoints >= 0) {
      complianceStatus = 'On Track';
      complianceSeverity = 'good';
    } else if (deltaPoints > -10) {
      complianceStatus = 'Needs Attention';
      complianceSeverity = 'warn';
    } else {
      complianceStatus = 'Serious Attention';
      complianceSeverity = 'bad';
    }

    const ringPercent =
      complianceSeverity === 'perfect' ? 100 : Math.min(trackedPercent, 100);

    const ringOfficeDays =
      targetPeriod === 'month' ? officeDays : weekOfficeDays;
    const ringWorkedDays =
      targetPeriod === 'month' ? workedDays : weekWorkedDays;

    // Current streak — consecutive attendance days (working backwards from today)
    let streak = 0;
    const sortedDates = weeklyLogs
      .filter((l) => l.status === 'present' || l.status === 'wfh')
      .map((l) => l.date)
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

    // Alert
    const remainingWorkdays = weekWorkdays - weekWorkedDays;
    const needsMore =
      remainingWorkdays > 0 &&
      (requiredPercent == null ? weekPercent < 50 : (deltaPoints ?? 0) < 0);

    return {
      compliance: {
        percent: ringPercent,
        currentDays: ringOfficeDays,
        totalDays: ringWorkedDays,
        status: complianceStatus,
        severity: complianceSeverity,
        meta: {
          targetPeriod,
          requiredPercent,
          trackedPercent,
          deltaPoints,
        },
      },
      weekly: {
        percent: Math.min(weekPercent, 100),
        label: 'Office Ratio',
        subtext: `${weekOfficeDays}/${weekWorkedDays || 0} Office Days`,
      },
      metrics: [
        {
          title: 'Current Streak',
          value: String(streak),
          subtext: 'Days',
          icon: 'flame' as const,
          color: '#FF9800',
        },
        {
          title: 'This Month',
          value: String(workedDays),
          subtext: `${officeDays} Office, ${homeDays} Home`,
          icon: 'calendar' as const,
        },
      ],
      alert: needsMore
        ? {
            title: 'Gap Detected',
            message: `You need ${remainingWorkdays} more day${remainingWorkdays > 1 ? 's' : ''} this week to stay on track.`,
            action: '',
          }
        : {
            title: 'Looking Good! 🎉',
            message: `You're on track this week.`,
            action: '',
          },
    };
  }, [weeklyLogs, profile]);

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Greeting Section */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600).springify()}
        >
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
        <Animated.View
          entering={FadeInDown.delay(150).duration(600).springify()}
          style={styles.section}
        >
          {!todayLog || (todayLog && !todayLog.check_out) ? ( // Show if not checked out yet
            <>
              <SlideAction
                label={todayLog ? 'Slide to Check Out' : 'Slide to Check In'}
                icon={todayLog ? 'log-out-outline' : 'log-in-outline'}
                color={todayLog ? theme.colors.warning : theme.colors.success}
                onSwipeSuccess={handleSwipeAction}
                disabled={
                  todayLog?.status === 'holiday' ||
                  todayLog?.status === 'leave' ||
                  calendarManagedToday
                }
                loading={isSubmittingAttendance}
              />
              {todayLog?.check_in &&
              !todayLog.check_out &&
              typeof openShiftMinutes === 'number' ? (
                <Text style={styles.helperText}>
                  Open shift: {Math.floor(openShiftMinutes / 60)}h{' '}
                  {openShiftMinutes % 60}m (live)
                </Text>
              ) : null}
              {calendarManagedToday ? (
                <Text style={styles.helperText}>
                  Today's status is set without check-in/out times. GPS
                  check-in/out is disabled for this day.
                </Text>
              ) : null}
            </>
          ) : (
            <View style={styles.shiftComplete}>
              <Text style={styles.shiftCompleteText}>Shift Complete ✅</Text>
            </View>
          )}
        </Animated.View>

        {/* Compliance Section */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600).springify()}
        >
          <View style={styles.section}>
            {attendanceLoading || authLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Updating dashboard...</Text>
              </View>
            ) : (
              <ProgressRing
                percent={dashboardMetrics.compliance.percent}
                currentDays={dashboardMetrics.compliance.currentDays}
                totalDays={dashboardMetrics.compliance.totalDays}
                status={dashboardMetrics.compliance.status}
                severity={dashboardMetrics.compliance.severity}
              />
            )}
          </View>
        </Animated.View>

        {/* Metrics Grid */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600).springify()}
        >
          <View style={styles.metricsRow}>
            {dashboardMetrics.metrics.map((metric, index) => (
              <View key={index} style={styles.metricWrapper}>
                <MetricCard {...metric} icon={metric.icon as any} />
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Weekly Stat Section */}
        <Animated.View
          entering={FadeInDown.delay(350).duration(600).springify()}
        >
          <View style={styles.section}>
            <WeeklyStatCard {...dashboardMetrics.weekly} />
          </View>
        </Animated.View>

        {/* Alert Section */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600).springify()}
        >
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
  loadingCard: {
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7EAF2',
    gap: 8,
  },
  loadingText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
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
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 16,
  },
});
