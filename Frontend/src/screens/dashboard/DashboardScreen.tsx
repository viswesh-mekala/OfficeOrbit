import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../theme/theme';
import { Header } from '../../components/layout/Header';
import { StatusPill } from '../../components/common/StatusPill';
import { ProgressRing } from '../../components/common/ProgressRing';
import { MetricCard } from '../../components/common/MetricCard';
import { AlertCard } from '../../components/common/AlertCard';
import { WeeklyStatCard } from '../../components/common/WeeklyStatCard';
import { useToast } from '../../components/common/Toast';

import { useAuth } from '../../store/AuthContext';
import { Ionicons } from '@expo/vector-icons';
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
import {
  evaluateWfoStreak,
  loadWfoStreakState,
  parseLocalDate,
  saveWfoStreakState,
} from '../../utils/wfoStreak';

export const Dashboard: React.FC = () => {
  const { user: authUser, profile, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const {
    todayLog,
    weeklyLogs,
    loading: attendanceLoading,
    refresh,
    refreshing,
  } = useAttendance();
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [persistedStreakCount, setPersistedStreakCount] = useState(0);

  // Fallback data
  const userName = profile?.username || authUser?.user_metadata?.name || 'User';

  const mergedAttendanceLogs = useMemo(() => {
    const map = new Map<string, (typeof weeklyLogs)[number]>();
    for (const log of weeklyLogs) {
      if (log?.date) map.set(log.date, log);
    }
    if (todayLog?.date) {
      map.set(todayLog.date, todayLog);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [weeklyLogs, todayLog]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const persisted = await loadWfoStreakState();
      if (cancelled) return;
      setPersistedStreakCount(persisted.streakCount ?? 0);
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

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
      showToast({
        title: 'Attendance already set',
        message: 'Update it from Attendance, or clear it before using swipe.',
        variant: 'warning',
      });
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
          showToast({ title: 'Check-out failed', message: error.message || 'Please try again.', variant: 'error' });
        } else {
          refresh();
          await addNotification({
            title: 'Checked out successfully',
            body: 'Your attendance has been marked for today.',
            type: 'attendance',
          });
          showToast({ title: 'Checked out successfully 👋', message: 'Your attendance has been marked.', variant: 'success' });
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
        showToast({ title: 'Location required', message: 'Enable location access to check in.', variant: 'warning' });
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
            showToast({ title: 'Check-in failed', message: error.message, variant: 'error' });
          } else {
            refresh();
            await addNotification({
              title: 'Checked in at office',
              body: 'Attendance marked successfully. Have a productive day!',
              type: 'attendance',
            });
            showToast({ title: 'Welcome! 🏢', message: 'Checked in at office', variant: 'success' });
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
                    showToast({ title: 'WFH check-in failed', message: error.message, variant: 'error' });
                  } else {
                    refresh();
                    await addNotification({
                      title: 'Marked as Work From Home',
                      body: 'You were away from office location during check-in.',
                      type: 'location',
                    });
                    showToast({ title: 'Marked as WFH', message: 'You were away from office location.', variant: 'success' });
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
                  showToast({ title: 'Check-in failed', message: error.message, variant: 'error' });
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
      showToast({ title: 'Location error', message: 'Could not verify your location.', variant: 'error' });
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
     * Monthly tracker (big ring): compares **month-to-date office-share** vs a
     * **required office share** derived from the user's configured target.
     *
     * Office-share (tracked%): present / (present + wfh), excluding leave/holiday.
     *
     * Required%: a stable ratio that does NOT fluctuate as the period progresses.
     *   - Weekly target:  requiredPercent = targetDays / weekdays-in-week  (e.g. 3/5 = 60%)
     *   - Monthly target: requiredPercent = targetDays / weekdays-in-month (e.g. 12/21 ≈ 57%)
     *
     * Status bands use margins around required% (±10 / ±20 points), see below.
     */
    const targetPeriod =
      profile?.office_target_period || profile?.wfh_period || 'week';
    const rawTargetDays =
      profile?.office_days_target != null
        ? profile.office_days_target
        : profile?.wfh_days != null
          ? profile.wfh_days
          : 0;

    // Required office % = target days / total workdays in the period.
    // Weekly example: 3 target / 5 weekdays = 60%
    // Monthly example: 12 target / 21 weekdays ≈ 57%
    const requiredPercent =
      rawTargetDays > 0
        ? targetPeriod === 'month'
          ? totalBusinessDays > 0
            ? Math.min(100, Math.round((rawTargetDays / totalBusinessDays) * 100))
            : null
          : weekWorkdays > 0
            ? Math.min(100, Math.round((rawTargetDays / weekWorkdays) * 100))
            : null
        : null;

    const trackedPercent = monthCompliancePercent;

    const deltaPoints =
      requiredPercent == null
        ? null
        : Math.round(trackedPercent - requiredPercent);

    let complianceStatus = 'Set office target';
    let complianceSeverity:
      | 'excellent'
      | 'great'
      | 'ok'
      | 'warn'
      | 'bad'
      | 'neutral' = 'neutral';

    if (deltaPoints == null || rawTargetDays <= 0 || requiredPercent == null) {
      complianceStatus = 'Set office target';
      complianceSeverity = 'neutral';
    } else if (trackedPercent >= requiredPercent + 20) {
      complianceStatus = 'Excellent 🔥👌';
      complianceSeverity = 'excellent';
    } else if (trackedPercent >= requiredPercent + 10) {
      complianceStatus = 'Good Keep going 👏';
      complianceSeverity = 'great';
    } else if (trackedPercent >= requiredPercent) {
      complianceStatus = 'On Track';
      complianceSeverity = 'ok';
    } else if (trackedPercent < requiredPercent - 20) {
      complianceStatus = 'Serious attention required ⚠️';
      complianceSeverity = 'bad';
    } else {
      // Covers [required-20, required) including the [-20,-10) gap as “warning band”
      complianceStatus = 'Needs attention';
      complianceSeverity = 'warn';
    }

    const ringPercent = Math.min(trackedPercent, 100);

    const ringOfficeDays = officeDays;
    const ringWorkedDays = workedDays;

    const streakPeriodType =
      profile?.office_target_period || profile?.wfh_period || 'week';
    const streakRawTargetDays =
      profile?.office_days_target != null
        ? profile.office_days_target
        : profile?.wfh_days != null
          ? profile.wfh_days
          : 0;

    const streakEval =
      streakRawTargetDays > 0
        ? evaluateWfoStreak({
            logs: mergedAttendanceLogs,
            periodType: streakPeriodType === 'month' ? 'month' : 'week',
            rawTargetDays: streakRawTargetDays,
          })
        : null;

    const streakCanonical = streakEval?.streakCount ?? 0;

    let streakBucketWeekdays = 0;
    if (streakEval?.periodType === 'month') {
      const [ys, ms] = streakEval.currentPeriodKey.split('-');
      const y = Number(ys);
      const m = Number(ms) - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      let c = 0;
      for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) c++;
      }
      streakBucketWeekdays = c;
    } else if (streakEval) {
      const mon = parseLocalDate(streakEval.currentPeriodKey);
      if (mon) {
        const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
        let c = 0;
        for (let cur = new Date(mon); cur <= sun; cur.setDate(cur.getDate() + 1)) {
          const dow = cur.getDay();
          if (dow !== 0 && dow !== 6) c++;
        }
        streakBucketWeekdays = c;
      }
    }

    const streakRequiredNow =
      streakEval?.requiredOfficeDays != null && streakBucketWeekdays > 0
        ? Math.min(streakEval.requiredOfficeDays, Math.max(1, streakBucketWeekdays))
        : null;

    const streakTitle =
      streakPeriodType === 'month' ? 'WFO streak (month)' : 'WFO streak (week)';

    const streakSubtext =
      streakEval && streakRequiredNow != null
        ? `${streakEval.currentPeriodOfficeDays}/${streakRequiredNow} this ${streakEval.periodType}`
        : 'Set office target';

    // ── Alert / Insight card ──
    // Variant driven by the same complianceSeverity as the monthly tracker ring.
    // Days deficit & remaining business days are still computed for the subtitle copy.
    const alertPeriodLabel = targetPeriod === 'month' ? 'month' : 'week';
    let alertCurrentOfficeDays = 0;
    let alertTargetDays = rawTargetDays;
    let alertDaysNeeded = 0;
    let alertRemainingDays = 0;

    if (rawTargetDays > 0) {
      const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

      if (targetPeriod === 'month') {
        alertCurrentOfficeDays = officeDays;
        alertDaysNeeded = Math.max(0, rawTargetDays - officeDays);
        for (let d = currentDay; d <= daysInMonth; d++) {
          const dow = new Date(currentYear, currentMonth, d).getDay();
          if (dow !== 0 && dow !== 6) alertRemainingDays++;
        }
      } else {
        alertCurrentOfficeDays = weekOfficeDays;
        alertTargetDays = rawTargetDays;
        alertDaysNeeded = Math.max(0, rawTargetDays - weekOfficeDays);
        alertRemainingDays = weekDates.filter((d) => {
          if (d < todayStr) return false;
          const dow = new Date(d + 'T12:00:00').getDay();
          return dow !== 0 && dow !== 6;
        }).length;
      }
    }

    // Map complianceSeverity → alert variant (single source of truth)
    const alertVariant: 'on_track' | 'behind' | 'critical' | 'no_target' =
      complianceSeverity === 'neutral'
        ? 'no_target'
        : complianceSeverity === 'bad'
          ? 'critical'
          : complianceSeverity === 'warn'
            ? 'behind'
            : 'on_track'; // excellent | great | ok

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
        label: 'Weekly tracker',
        subtext: `${weekOfficeDays}/${weekWorkedDays || 0} Office Days`,
      },
      metrics: [
        {
          title: streakTitle,
          value: String(streakCanonical),
          subtext: streakSubtext,
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
      alert: {
        variant: alertVariant,
        daysNeeded: alertDaysNeeded,
        periodLabel: alertPeriodLabel,
        currentOfficeDays: alertCurrentOfficeDays,
        targetDays: alertTargetDays,
        remainingBusinessDays: alertRemainingDays,
      },
      streakEval,
    };
  }, [weeklyLogs, profile, mergedAttendanceLogs, todayLog]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const persisted = await loadWfoStreakState();
      if (cancelled) return;

      const evalSnapshot = dashboardMetrics.streakEval;
      if (!evalSnapshot?.lastProcessedPeriodKey) return;

      const canonical = evalSnapshot.streakCount;
      const lastKey = evalSnapshot.lastProcessedPeriodKey;

      if (
        persisted.lastProcessedPeriodKey !== lastKey &&
        canonical > (persisted.streakCount ?? 0)
      ) {
        await saveWfoStreakState({
          streakCount: canonical,
          lastProcessedPeriodKey: lastKey,
        });
        if (!cancelled) setPersistedStreakCount(canonical);
      } else if (
        persisted.lastProcessedPeriodKey !== lastKey &&
        canonical === 0 &&
        evalSnapshot.lastClosedOk === false
      ) {
        await saveWfoStreakState({
          streakCount: 0,
          lastProcessedPeriodKey: lastKey,
        });
        if (!cancelled) setPersistedStreakCount(0);
      }
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, [dashboardMetrics.streakEval]);

  const streakEvalSnapshot = dashboardMetrics.streakEval;

  let streakBucketWeekdaysLive = 0;
  if (streakEvalSnapshot?.periodType === 'month') {
    const [ys, ms] = streakEvalSnapshot.currentPeriodKey.split('-');
    const y = Number(ys);
    const m = Number(ms) - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    let c = 0;
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) c++;
    }
    streakBucketWeekdaysLive = c;
  } else if (streakEvalSnapshot) {
    const mon = parseLocalDate(streakEvalSnapshot.currentPeriodKey);
    if (mon) {
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      let c = 0;
      for (let cur = new Date(mon); cur <= sun; cur.setDate(cur.getDate() + 1)) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) c++;
      }
      streakBucketWeekdaysLive = c;
    }
  }

  const streakRequiredNowLive =
    streakEvalSnapshot?.requiredOfficeDays != null && streakBucketWeekdaysLive > 0
      ? Math.min(
          streakEvalSnapshot.requiredOfficeDays,
          Math.max(1, streakBucketWeekdaysLive),
        )
      : null;

  const streakCanonicalLive = streakEvalSnapshot?.streakCount ?? 0;
  /** Consecutive completed periods that met the office-day minimum */
  const streakClosedPeriodsLive = Math.max(persistedStreakCount, streakCanonicalLive);
  /**
   * Card total = closed-period streak + office weekdays logged so far this open period,
   * so the count rises with each qualifying office day (not only when the period closes).
   */
  const streakDisplayedTotal =
    streakEvalSnapshot?.requiredOfficeDays != null
      ? streakClosedPeriodsLive + streakEvalSnapshot.currentPeriodOfficeDays
      : 0;

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
                {metric.icon === 'flame' ? (
                  <View style={styles.metricCardWrap}>
                    <MetricCard
                      {...metric}
                      icon={metric.icon as any}
                      value={
                        index === 0 ? String(streakDisplayedTotal) : metric.value
                      }
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Streak details"
                      style={styles.metricMenuBtn}
                      onPress={() => setStreakModalVisible(true)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={18}
                        color={theme.colors.text.secondary}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <MetricCard {...metric} icon={metric.icon as any} />
                )}
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

      <Modal
        visible={streakModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStreakModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStreakModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Office streak</Text>
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {streakEvalSnapshot ? (
                <>
                  <Text style={styles.modalLead}>
                    Flame total = periods in a row that hit your office weekday goal,
                    plus office weekdays logged so far this period (Mon–Fri).
                  </Text>
                  <Text style={styles.modalBullet}>
                    • Counts Mon–Fri office (present) only — not weekends, leave, or
                    holiday.
                  </Text>
                  <Text style={styles.modalBullet}>
                    • Bucket: weekly Mon–Sun or calendar month (Profile). Goal never
                    exceeds weekdays in that bucket. Checked when the period ends.
                  </Text>
                  <Text style={styles.modalBullet}>
                    • Reset: finish a period below goal → streak drops to 0 (only
                    this score; calendar history stays).
                  </Text>
                  <Text style={styles.modalBullet}>
                    •{' '}
                    {streakEvalSnapshot.periodType === 'month' ? 'Month' : 'Week'} mode
                    · Goal {streakEvalSnapshot.requiredOfficeDays ?? '—'} office
                    weekdays · Now {streakEvalSnapshot.currentPeriodOfficeDays}/
                    {streakRequiredNowLive ?? '—'} · Periods streak{' '}
                    {streakClosedPeriodsLive} · Card {String(streakDisplayedTotal)}
                  </Text>
                  {streakEvalSnapshot.lastClosedPeriodKey ? (
                    <Text style={styles.modalBulletMuted}>
                      Last closed {streakEvalSnapshot.periodType}:{' '}
                      {streakEvalSnapshot.lastClosedPeriodKey},{' '}
                      {streakEvalSnapshot.lastClosedOfficeDays ?? '—'} office days —{' '}
                      {streakEvalSnapshot.lastClosedOk ? 'met goal' : 'under goal'}.
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.modalLead}>
                  Set office weekdays + week/month mode in Profile to enable this.
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setStreakModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  metricCardWrap: {
    position: 'relative',
  },
  metricMenuBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7EAF2',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 10,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalLead: {
    fontSize: 13,
    color: theme.colors.text.primary,
    lineHeight: 19,
    marginBottom: 10,
    fontWeight: '600',
  },
  modalBullet: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    lineHeight: 19,
    marginBottom: 8,
    paddingLeft: 2,
  },
  modalBulletMuted: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    lineHeight: 17,
    marginTop: 4,
    opacity: 0.85,
  },
  modalClose: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
