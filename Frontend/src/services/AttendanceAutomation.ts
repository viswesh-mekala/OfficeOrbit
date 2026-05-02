import * as SecureStore from 'expo-secure-store';
import type { LocationObject } from 'expo-location';
import { callApi } from './api/apiClient';
import { clockIn, clockOut } from './AttendanceService';
import { getDistanceFromLatLonInMeters } from '../utils/locationUtils';
import { addNotification } from './NotificationService';
import type { UserProfile } from '../types/auth.types';
import { isCalendarManagedDay } from '../utils/attendancePolicy';

type CompanyLocation = { latitude: number; longitude: number };

type Profile = Pick<UserProfile, 'company_location' | 'minimum_login_time_minutes'>;

type AttendanceToday = {
  id: string;
  status: 'present' | 'wfh' | 'leave' | 'holiday' | 'absent' | string;
  check_in: string | null;
  check_out: string | null;
};

type AutomationState = {
  outsideSinceMs: number | null;
  lastAutoActionAtMs: number | null;
  lastAutoActionType: 'checkin' | 'checkout' | null;
};

const STORAGE_KEY = 'officeorbit_attendance_automation_v1';

const RADIUS_METERS = 500;
const COOLDOWN_MS = 10 * 60 * 1000;
/** Fallback if profile minimum login minutes is missing (matches DB default ~8h). */
const DEFAULT_MINIMUM_LOGIN_MINUTES = 480;
/**
 * Minimum-stay before allowing auto-checkout is derived from the user's configured minimum daily login.
 * We use 50% as the guardrail window against GPS drift right after check-in.
 */
const MIN_STAY_FRACTION_OF_MINIMUM_LOGIN = 0.5;
/** Safety floor so tiny configured minimums don't collapse protections entirely. */
const MIN_STAY_FLOOR_MS = 10 * 60 * 1000;
const OUTSIDE_LONG_BREAK_MS = 90 * 60 * 1000;

// If user is clearly far away, allow faster checkout.
const FAR_DISTANCE_METERS = 1500;
const FAR_DISTANCE_CONFIRM_MS = 15 * 60 * 1000;

const safeJsonParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const loadState = async (): Promise<AutomationState> => {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  const parsed = safeJsonParse<AutomationState>(raw);
  return {
    outsideSinceMs: parsed?.outsideSinceMs ?? null,
    lastAutoActionAtMs: parsed?.lastAutoActionAtMs ?? null,
    lastAutoActionType: parsed?.lastAutoActionType ?? null,
  };
};

const saveState = async (state: AutomationState) => {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // If storage fails, proceed without persistence.
  }
};

const isInCooldown = (state: AutomationState, nowMs: number) => {
  if (!state.lastAutoActionAtMs) return false;
  return nowMs - state.lastAutoActionAtMs < COOLDOWN_MS;
};

const asSampleTimeMs = (sample: Pick<LocationObject, 'timestamp'>): number => {
  // expo-location timestamp is ms on most platforms, but keep it safe.
  const ts = (sample as any)?.timestamp;
  if (typeof ts === 'number') return ts;
  return Date.now();
};

const sortSamplesAsc = (samples: LocationObject[]) =>
  [...samples].sort((a, b) => asSampleTimeMs(a) - asSampleTimeMs(b));

export async function processAttendanceLocationSamples(
  samples: LocationObject[],
  source: 'background' | 'oneshot'
) {
  if (!samples || samples.length === 0) return;

  // Skip weekends — no auto-attendance on Saturday/Sunday.
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return;

  const sorted = sortSamplesAsc(samples).filter((s) => !!s?.coords);
  if (sorted.length === 0) return;

  // Fetch profile once per run (office location + minimum login settings).
  const { data: profile, error: profileError } = await callApi<Profile>('profile-get');
  if (profileError || !profile?.company_location) return;

  const minimumLoginMinutes =
    typeof profile.minimum_login_time_minutes === 'number' && profile.minimum_login_time_minutes > 0
      ? profile.minimum_login_time_minutes
      : DEFAULT_MINIMUM_LOGIN_MINUTES;

  const minStayBeforeCheckoutMs = Math.max(
    MIN_STAY_FLOOR_MS,
    Math.round(minimumLoginMinutes * MIN_STAY_FRACTION_OF_MINIMUM_LOGIN * 60 * 1000)
  );

  // Fetch today log once per run; we update local copy after actions.
  const todayResp = await callApi<AttendanceToday>('attendance-today');
  let todayLog = todayResp.data ?? null;

  // Calendar-managed day (status without timestamps) — do not run GPS automation.
  if (isCalendarManagedDay(todayLog as any)) {
    return;
  }

  // Skip on holiday/leave.
  if (todayLog && (todayLog.status === 'holiday' || todayLog.status === 'leave')) {
    return;
  }

  let state = await loadState();

  const officeLat = profile.company_location.latitude;
  const officeLng = profile.company_location.longitude;

  for (const sample of sorted) {
    const nowMs = asSampleTimeMs(sample);

    const distance = getDistanceFromLatLonInMeters(
      sample.coords.latitude,
      sample.coords.longitude,
      officeLat,
      officeLng
    );

    const inside = distance <= RADIUS_METERS;

    // Track outside duration for break/checkout logic.
    if (inside) {
      if (state.outsideSinceMs) {
        state.outsideSinceMs = null;
        await saveState(state);
      }
    } else {
      if (!state.outsideSinceMs) {
        state.outsideSinceMs = nowMs;
        await saveState(state);
      }
    }

    // Cooldown prevents action spam, but we still track outsideSince.
    if (isInCooldown(state, nowMs)) {
      continue;
    }

    // Auto check-in: anytime if inside radius and no log exists yet.
    if (inside && !todayLog) {
      const { data: checkinData, error: checkInError } = await clockIn('present', {
        latitude: sample.coords.latitude,
        longitude: sample.coords.longitude,
        address: source === 'oneshot' ? 'Auto-Detected at Office (Login)' : 'Auto-Detected at Office',
      });

      if (checkInError) {
        await addNotification({
          title: 'Auto check-in failed',
          body: checkInError.message || 'Automatic office check-in could not be completed.',
          type: 'automation',
        });
      } else {
        todayLog = (checkinData as any) ?? todayLog;
        state.lastAutoActionAtMs = nowMs;
        state.lastAutoActionType = 'checkin';
        await saveState(state);
        await addNotification({
          title: 'Auto check-in completed',
          body: 'You arrived at office and attendance was marked automatically.',
          type: 'automation',
        });
      }

      continue;
    }

    // Auto checkout: only if checked-in and currently outside.
    if (!inside && todayLog && todayLog.status === 'present' && !todayLog.check_out) {
      // Minimum stay guardrail.
      const checkInMs = todayLog.check_in ? new Date(todayLog.check_in).getTime() : null;
      if (!checkInMs || nowMs - checkInMs < minStayBeforeCheckoutMs) {
        continue;
      }

      const outsideDurationMs = state.outsideSinceMs ? nowMs - state.outsideSinceMs : 0;

      const longBreak = outsideDurationMs >= OUTSIDE_LONG_BREAK_MS;
      const farFastCheckout =
        distance >= FAR_DISTANCE_METERS && outsideDurationMs >= FAR_DISTANCE_CONFIRM_MS;

      if (!longBreak && !farFastCheckout) {
        // Optional: for background only, we can notify once when outside is detected.
        // Avoid spamming—only when just started outside window.
        if (source === 'background' && outsideDurationMs < 2 * 60 * 1000) {
          await addNotification({
            title: 'Outside office boundary detected',
            body: 'You are outside the office area. Attendance will auto-checkout if you stay outside for long.',
            type: 'location',
          });
        }
        continue;
      }

      const { error: clockOutError } = await clockOut();
      if (clockOutError) {
        await addNotification({
          title: 'Auto checkout failed',
          body: clockOutError.message || 'Automatic checkout could not be completed.',
          type: 'automation',
        });
        continue;
      }

      state.lastAutoActionAtMs = nowMs;
      state.lastAutoActionType = 'checkout';
      state.outsideSinceMs = null;
      await saveState(state);

      await addNotification({
        title: 'Auto checkout completed',
        body: 'You were checked out automatically after leaving office.',
        type: 'automation',
      });

      // Once checked out, stop processing further samples in this batch.
      break;
    }
  }
}

