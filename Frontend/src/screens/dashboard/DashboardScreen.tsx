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
  Linking,
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
import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../store/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useAttendance } from '../../hooks/useAttendance';
import useEntitlements from '../../hooks/useEntitlements';
import { AdSlot } from '../../components/ads/AdSlot';
import { PaywallModal } from '../../components/billing/PaywallModal';
import { AdInterstitial } from '../../components/ads/AdInterstitial';
import { LinearGradient } from 'expo-linear-gradient';
import { useAttendanceRecovery } from '../../hooks/useAttendanceRecovery';
import { AppDialog } from '../../components/common/AppDialog';
import { SlideAction } from '../../components/common/SlideAction';
import {
  clockIn,
  clockOut,
  queueOfflineAttendanceAction,
} from '../../services/AttendanceService';
import { getDistanceFromLatLonInMeters } from '../../utils/locationUtils';
import { addNotification, sendDeviceNotification } from '../../services/NotificationService';
import { AttendanceRecoveryBanner } from '../../components/common/AttendanceRecoveryBanner';
import {
  isLikelyNetworkError,
  queueAttendanceRecovery,
  queueAttendanceRecoveryFromError,
} from '../../services/AttendanceRecoveryService';
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
  const params = useLocalSearchParams<{ recovery?: string }>();
  const { user: authUser, profile, loading: authLoading } = useAuth();
  const { planCode, capabilities } = useEntitlements();
  const { showToast } = useToast();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const {
    todayLog,
    weeklyLogs,
    loading: attendanceLoading,
    refresh,
    refreshing,
    optimisticUpdate,
  } = useAttendance();
  const { pendingRecovery, clearRecovery } = useAttendanceRecovery();

  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [persistedStreakCount, setPersistedStreakCount] = useState(0);
  const [showFirstDayHint, setShowFirstDayHint] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [interstitialVisible, setInterstitialVisible] = useState(false);

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

  useEffect(() => {
    if (!pendingRecovery) return;

    if (pendingRecovery.action === 'checkin' && todayLog?.check_in) {
      void clearRecovery('checkin');
      return;
    }

    if (pendingRecovery.action === 'checkout' && todayLog?.check_out) {
      void clearRecovery('checkout');
    }
  }, [clearRecovery, pendingRecovery, todayLog?.check_in, todayLog?.check_out]);

  useEffect(() => {
    if (params.recovery === '1' && pendingRecovery) {
      setShowRecoveryDialog(true);
    }
  }, [params.recovery, pendingRecovery]);

  // ── First Day "Teachable Moment" Check ──
  useEffect(() => {
    const checkFirstDayLocation = async () => {
      // Only run this check if they have NO attendance history yet
      if (weeklyLogs.length > 0 || todayLog || !profile?.company_location) return;

      try {
        const hasSeen = await SecureStore.getItemAsync('has_seen_first_day_hint');
        if (hasSeen) return;

        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;

        // Use a quick cached location so we don't keep the GPS radio on
        const pos = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
        if (!pos) return;

        const dist = getDistanceFromLatLonInMeters(
          pos.coords.latitude, pos.coords.longitude,
          profile.company_location.latitude, profile.company_location.longitude
        );

        if (dist <= 500) {
          setShowFirstDayHint(true);
          await SecureStore.setItemAsync('has_seen_first_day_hint', 'true');
        }
      } catch (err) {
        // Silent fail — it's just a hint
      }
    };

    if (!attendanceLoading) {
      checkFirstDayLocation();
    }
  }, [attendanceLoading, weeklyLogs.length, todayLog, profile?.company_location]);

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

  const dismissRecoveryBanner = async () => {
    setShowRecoveryDialog(false);
    await clearRecovery();
  };

  const openRecoverySettings = async () => {
    setShowRecoveryDialog(false);
    await Linking.openSettings();
  };

  const queueManualFailureRecovery = async (input: {
    action: 'checkin' | 'checkout';
    errorMessage?: string | null;
    reason?: 'location_permission' | 'location_off' | 'location_unavailable' | 'network_error' | 'api_failed' | 'office_location_missing';
    queuedOffline?: boolean;
  }) => {
    if (input.reason) {
      await queueAttendanceRecovery({
        action: input.action,
        source: 'manual',
        reason: input.reason,
        detail: input.errorMessage ?? null,
        queuedOffline: input.queuedOffline,
      });
      return;
    }

    await queueAttendanceRecoveryFromError({
      action: input.action,
      source: 'manual',
      errorMessage: input.errorMessage,
      fallbackReason: 'api_failed',
      queuedOffline: input.queuedOffline,
    });
  };

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

    try {
      // CASE 1: Manual Check Out — optimistic update fires immediately
      if (todayLog && !todayLog.check_out) {
        // Update UI right now — user sees 'Checked Out' before API responds
        const rollback = optimisticUpdate({ check_out: new Date().toISOString() });
        const checkoutPayload = { source: 'manual' as const };
        const { data: checkoutResult, error } = await clockOut('manual');
        if (error) {
          rollback(); // revert the optimistic change
          const isNetworkFailure = isLikelyNetworkError(error.message);
          if (isNetworkFailure) {
            await queueOfflineAttendanceAction('checkout', checkoutPayload);
          }
          await queueManualFailureRecovery({
            action: 'checkout',
            errorMessage: error.message,
            reason: isNetworkFailure ? 'network_error' : undefined,
            queuedOffline: isNetworkFailure,
          });
          await addNotification({
            title: 'Check-out failed',
            body: error.message || 'We could not check you out. Please try again.',
            type: 'attendance',
          });
          showToast({ title: 'Check-out failed', message: error.message || 'Please try again.', variant: 'error' });
        } else {
          await clearRecovery('checkout');
          refresh();
          const totalMin: number = (checkoutResult as any)?.total_minutes ?? (checkoutResult as any)?.duration_minutes ?? 0;
          const hrs = Math.floor(totalMin / 60);
          const mins = totalMin % 60;
          const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          const msg = `${durationStr} logged today. Have a great evening!`;
          await sendDeviceNotification('👋 Checked Out', msg);
          await addNotification({
            title: 'Checked out successfully',
            body: msg,
            type: 'attendance',
          });
          showToast({ title: 'Checked out successfully 👋', message: 'Your attendance has been marked.', variant: 'success' });
          if (capabilities.ads_enabled) {
            setInterstitialVisible(true);
          }
        }
        return;
      }


      // CASE 2: Check In
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        await queueManualFailureRecovery({
          action: 'checkin',
          reason: 'location_off',
        });
        await addNotification({
          title: 'Location is off',
          body: 'Turn on location services to continue check-in.',
          type: 'location',
        });
        showToast({ title: 'Location is off', message: 'Enable location services to check in.', variant: 'warning' });
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await queueManualFailureRecovery({
          action: 'checkin',
          reason: 'location_permission',
        });
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
          // Optimistic: mark present instantly before API confirms
          const rollback = optimisticUpdate({
            check_in: new Date().toISOString(),
            status  : 'present',
          });
          const manualOfficePayload = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            address: 'Office (Manual Swipe)',
          };
          const { error } = await clockIn('present', manualOfficePayload, 'manual');

          if (error) {
            rollback(); // revert optimistic update
            const isNetworkFailure = isLikelyNetworkError(error.message);
            if (isNetworkFailure) {
              await queueOfflineAttendanceAction('checkin', {
                location: manualOfficePayload,
                status: 'present',
                source: 'manual',
              });
            }
            await queueManualFailureRecovery({
              action: 'checkin',
              errorMessage: error.message,
              reason: isNetworkFailure ? 'network_error' : undefined,
              queuedOffline: isNetworkFailure,
            });
            await addNotification({
              title: 'Check-in failed',
              body: error.message || 'We could not check you in at office.',
              type: 'attendance',
            });
            showToast({ title: 'Check-in failed', message: error.message, variant: 'error' });
          } else {
            await clearRecovery('checkin');
            refresh();
            await sendDeviceNotification('🏢 Checked In at Office', 'Attendance marked. Have a productive day!');
            await addNotification({
              title: 'Checked in at office',
              body: 'Attendance marked successfully. Have a productive day!',
              type: 'attendance',
            });
            showToast({ title: 'Welcome! 🏢', message: 'Checked in at office', variant: 'success' });
            if (capabilities.ads_enabled) {
              setInterstitialVisible(true);
            }
          }

        } else {
          // Far from office — offer WFH
          Alert.alert(
            'Away From Office Location',
            'You are outside the office boundary. Do you want to continue and mark attendance as Work From Home?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Mark WFH',
                onPress: async () => {
                  const manualWfhPayload = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    address: 'Remote',
                  };
                  const { error } = await clockIn('wfh', manualWfhPayload, 'manual');
                  if (error) {
                    const isNetworkFailure = isLikelyNetworkError(error.message);
                    if (isNetworkFailure) {
                      await queueOfflineAttendanceAction('checkin', {
                        location: manualWfhPayload,
                        status: 'wfh',
                        source: 'manual',
                      });
                    }
                    await queueManualFailureRecovery({
                      action: 'checkin',
                      errorMessage: error.message,
                      reason: isNetworkFailure ? 'network_error' : undefined,
                      queuedOffline: isNetworkFailure,
                    });
                    await addNotification({
                      title: 'WFH check-in failed',
                      body: error.message || 'Unable to mark Work From Home.',
                      type: 'attendance',
                    });
                    showToast({ title: 'WFH check-in failed', message: error.message, variant: 'error' });
                  } else {
                    await clearRecovery('checkin');
                    refresh();
                    await sendDeviceNotification('🏠 Marked as WFH', 'You were away from the office. Attendance marked as Work From Home.');
                    await addNotification({
                      title: 'Marked as Work From Home',
                      body: 'You were away from office location during check-in.',
                      type: 'location',
                    });
                    showToast({ title: 'Marked as WFH', message: 'You were away from office location.', variant: 'success' });
                    if (capabilities.ads_enabled) {
                      setInterstitialVisible(true);
                    }
                  }
                },
              },
            ],
          );
        }

      } else {
        // No company location set — allow checkin with warning
        await queueAttendanceRecovery({
          action: 'checkin',
          source: 'manual',
          reason: 'office_location_missing',
        });
        Alert.alert(
          'No Office Location Set',
          "You haven't set your office location yet. Check in as Work From Home?",
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Check In as WFH',
              onPress: async () => {
                const manualWfhNoOfficePayload = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  address: 'Remote (No Office Set)',
                };
                const { error } = await clockIn('wfh', manualWfhNoOfficePayload);
                if (error) {
                  const isNetworkFailure = isLikelyNetworkError(error.message);
                  if (isNetworkFailure) {
                    await queueOfflineAttendanceAction('checkin', {
                      location: manualWfhNoOfficePayload,
                      status: 'wfh',
                      source: 'manual',
                    });
                  }
                  await queueManualFailureRecovery({
                    action: 'checkin',
                    errorMessage: error.message,
                    reason: isNetworkFailure ? 'network_error' : 'office_location_missing',
                    queuedOffline: isNetworkFailure,
                  });
                  await addNotification({
                    title: 'WFH check-in failed',
                    body: error.message || 'Unable to check in right now.',
                    type: 'attendance',
                  });
                  showToast({ title: 'Check-in failed', message: error.message, variant: 'error' });
                } else {
                  await clearRecovery('checkin');
                  refresh();
                  await addNotification({
                    title: 'Checked in as Work From Home',
                    body: 'No office location is set on your profile yet.',
                    type: 'system',
                  });
                  showToast({ title: 'Check-in succeeded', message: 'Checked in as WFH (no office set).', variant: 'success' });
                  if (capabilities.ads_enabled) {
                    setInterstitialVisible(true);
                  }
                }
              },
            },
          ],
        );
      }
    } catch (error) {
      await queueManualFailureRecovery({
        action: 'checkin',
        reason: 'location_unavailable',
        errorMessage: error instanceof Error ? error.message : 'Could not verify your location while checking attendance.',
      });
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

      {/* First Day Hint Dialog */}
      <AppDialog
        visible={showFirstDayHint}
        icon="location"
        title="Looks like you're at the office! 🏢"
        message={"Slide the button below to log your very first check-in.\n\nFrom tomorrow, this will happen automatically while your phone is in your pocket!"}
        confirmLabel="Got it!"
        onConfirm={() => setShowFirstDayHint(false)}
        onCancel={() => setShowFirstDayHint(false)}
      />

      {pendingRecovery ? (
        <AppDialog
          visible={showRecoveryDialog}
          icon={pendingRecovery.requiresSettings ? 'settings-outline' : 'warning-outline'}
          iconColor={pendingRecovery.requiresSettings ? '#D97706' : '#EF4444'}
          title={pendingRecovery.title}
          message={pendingRecovery.body}
          confirmLabel={pendingRecovery.requiresSettings ? 'Open Settings' : 'Continue'}
          cancelLabel="Later"
          onConfirm={() => {
            if (pendingRecovery.requiresSettings) {
              void openRecoverySettings();
              return;
            }
            setShowRecoveryDialog(false);
          }}
          onCancel={() => setShowRecoveryDialog(false)}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
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
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingTitle}>{getGreeting()}</Text>
              <View style={styles.nameAvatarRow}>
                <Text style={styles.greetingName} numberOfLines={1}>{userName}</Text>
                
                {/* Glowing Active Plan Avatar Ring */}
                <TouchableOpacity 
                  onPress={() => setPaywallVisible(true)}
                  style={[
                    styles.headerAvatarOuter,
                    planCode === 'pro_lifetime' && styles.avatarRingPro,
                    planCode === 'auto_lifetime' && styles.avatarRingAuto,
                  ]}
                >
                  <LinearGradient
                    colors={
                      planCode === 'auto_lifetime'
                        ? ['#FF5252', '#FF8F8F']
                        : planCode === 'pro_lifetime'
                        ? ['#5B4DFF', '#7B6FFF']
                        : ['#888888', '#B0B0B0']
                    }
                    style={styles.avatarGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.headerAvatarText}>
                      {(userName || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            <StatusPill
              status={statusText}
              location={locationText}
              variant={statusVariant}
            />
          </View>
        </Animated.View>

        {pendingRecovery ? (
          <Animated.View
            entering={FadeInDown.delay(130).duration(600).springify()}
            style={styles.section}
          >
            <AttendanceRecoveryBanner
              recovery={pendingRecovery}
              onDismiss={() => {
                void dismissRecoveryBanner();
              }}
              onOpenSettings={
                pendingRecovery.requiresSettings
                  ? () => {
                      void openRecoverySettings();
                    }
                  : undefined
              }
            />
          </Animated.View>
        ) : null}

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
                testID="dashboard-attendance-slide"
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

        {/* Dynamic Ad Slot for Free Tier */}
        <AdSlot onUpgradePress={() => setPaywallVisible(true)} />

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
            {/* ── Streak Card (bespoke) ── */}
            <View style={styles.metricWrapper}>
              <TouchableOpacity
                style={styles.streakCard}
                onPress={() => setStreakModalVisible(true)}
                activeOpacity={0.85}
              >
                {/* top row */}
                <View style={styles.streakTopRow}>
                  <View style={styles.streakIconWrap}>
                    <Text style={styles.streakEmoji}>🔥</Text>
                  </View>
                  <View style={styles.streakTextGroup}>
                    <Text style={styles.streakCount}>{streakDisplayedTotal}</Text>
                    <Text style={styles.streakLabel}>Streak</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#FF9800" />
                </View>

                {/* Progress bar for current period */}
                {streakEvalSnapshot && streakRequiredNowLive != null ? (
                  <View style={styles.streakProgressArea}>
                    <View style={styles.streakProgressTrack}>
                      <View
                        style={[
                          styles.streakProgressFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.round(
                                (streakEvalSnapshot.currentPeriodOfficeDays /
                                  streakRequiredNowLive) *
                                  100,
                              ),
                            )}%` as any,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.streakProgressLabel}>
                      {streakEvalSnapshot.currentPeriodOfficeDays}/{streakRequiredNowLive} office days this{' '}
                      {streakEvalSnapshot.periodType}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.streakNoTarget}>Tap to set up your streak</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ── This Month Card ── */}
            <View style={styles.metricWrapper}>
              <MetricCard
                title={dashboardMetrics.metrics[1].title}
                value={dashboardMetrics.metrics[1].value}
                subtext={dashboardMetrics.metrics[1].subtext}
                icon={dashboardMetrics.metrics[1].icon as any}
              />
            </View>
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

      {/* ── Streak Modal (redesigned) ── */}
      <Modal
        visible={streakModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStreakModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStreakModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Text style={styles.modalEmoji}>🔥</Text>
                <View>
                  <Text style={styles.modalTitle}>Office Streak</Text>
                  <Text style={styles.modalSubheader}>
                    {(profile?.office_target_period || 'week') === 'month' ? 'Monthly tracking mode' : 'Weekly tracking mode'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setStreakModalVisible(false)} style={styles.modalCloseIcon}>
                <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {streakEvalSnapshot ? (
              <>
                {/* Big number */}
                <View style={styles.modalBigStat}>
                  <Text style={styles.modalBigNumber}>{streakDisplayedTotal}</Text>
                  <Text style={styles.modalBigLabel}>Total streak score</Text>
                </View>

                {/* Stat rows */}
                <View style={styles.modalStatGrid}>
                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatIcon}>
                      <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                    </View>
                    <View style={styles.modalStatText}>
                      <Text style={styles.modalStatLabel}>Completed periods</Text>
                      <Text style={styles.modalStatValue}>{streakClosedPeriodsLive} in a row</Text>
                    </View>
                  </View>

                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatIcon}>
                      <Ionicons name="today" size={18} color={theme.colors.primary} />
                    </View>
                    <View style={styles.modalStatText}>
                      <Text style={styles.modalStatLabel}>This {streakEvalSnapshot.periodType}</Text>
                      <Text style={styles.modalStatValue}>
                        {streakEvalSnapshot.currentPeriodOfficeDays} of{' '}
                        {streakRequiredNowLive ?? '—'} office days logged
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatIcon}>
                      <Ionicons name="trophy" size={18} color="#FF9800" />
                    </View>
                    <View style={styles.modalStatText}>
                      <Text style={styles.modalStatLabel}>Target</Text>
                      <Text style={styles.modalStatValue}>
                        {streakEvalSnapshot.requiredOfficeDays ?? '—'} office days per{' '}
                        {streakEvalSnapshot.periodType}
                      </Text>
                    </View>
                  </View>

                  {streakEvalSnapshot.lastClosedPeriodKey ? (
                    <View style={styles.modalStatRow}>
                      <View style={styles.modalStatIcon}>
                        <Ionicons
                          name={streakEvalSnapshot.lastClosedOk ? 'star' : 'close-circle'}
                          size={18}
                          color={streakEvalSnapshot.lastClosedOk ? '#FF9800' : '#D32F2F'}
                        />
                      </View>
                      <View style={styles.modalStatText}>
                        <Text style={styles.modalStatLabel}>Last completed {streakEvalSnapshot.periodType}</Text>
                        <Text style={styles.modalStatValue}>
                          {streakEvalSnapshot.lastClosedOfficeDays ?? '—'} office days —{' '}
                          {streakEvalSnapshot.lastClosedOk ? '✅ Goal met!' : '❌ Below goal'}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* How it works note */}
                <View style={styles.modalNote}>
                  <Ionicons name="information-circle-outline" size={14} color="#888" />
                  <Text style={styles.modalNoteText}>
                    Score = closed periods that hit your goal + office days logged so far this {streakEvalSnapshot.periodType}. Missing your goal in any period resets the streak to 0.
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.modalEmptyState}>
                <Text style={styles.modalEmptyIcon}>🎯</Text>
                <Text style={styles.modalEmptyTitle}>No target set yet</Text>
                <Text style={styles.modalEmptyDesc}>
                  Go to Profile → Schedule and set your office-day target to activate the streak tracker.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
      <AdInterstitial
        visible={interstitialVisible}
        onClose={() => setInterstitialVisible(false)}
      />
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
    paddingBottom: 32,
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
  // ── Streak Card ──
  streakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flex: 1,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E7EAF2',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  /* ── Header Avatar & Plan Badges ── */
  nameAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  headerAvatarOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    padding: 2,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarRingPro: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  avatarRingAuto: {
    borderColor: '#FF5252',
    shadowColor: '#FF5252',
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakTextGroup: {
    flex: 1,
  },
  streakCount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF9800',
    letterSpacing: -0.5,
  },
  streakLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF9800',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  streakProgressArea: {
    gap: 5,
  },
  streakProgressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  streakProgressFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF9800',
  },
  streakProgressLabel: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '600',
  },
  streakNoTarget: {
    fontSize: 10,
    color: '#BBBBCC',
    fontWeight: '500',
  },
  // ── Modal (redesigned) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: '#E7EAF2',
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalEmoji: {
    fontSize: 28,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  modalSubheader: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBigStat: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalBigNumber: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FF9800',
    letterSpacing: -2,
  },
  modalBigLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    marginTop: -4,
  },
  modalStatGrid: {
    gap: 12,
  },
  modalStatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
  },
  modalStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  modalStatText: {
    flex: 1,
    gap: 2,
  },
  modalStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F8F8FF',
    borderRadius: 10,
    padding: 12,
  },
  modalNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  modalEmptyIcon: {
    fontSize: 40,
  },
  modalEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  modalEmptyDesc: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
