/**
 * AttendanceAutomation.ts (v2 — event-driven multi-session model)
 *
 * Replaces the old batch-polling approach with three focused handlers:
 *
 *   handleGeofenceEnter()      → Called on OS GEOFENCE_ENTER event.
 *                                 Does NOT immediately check in — instead starts a
 *                                 5-minute dwell confirmation to filter bike/car pass-bys.
 *
 *   handleGeofenceExit()       → Called on OS GEOFENCE_EXIT event.
 *                                 Starts exit confirmation polling. The poller calls
 *                                 handleExitConfirmSample() every 3 min.
 *
 *   handleExitConfirmSample()  → Called by EXIT_CONFIRM_TASK every ~3 min.
 *                                 Returns true when exit is confirmed (triggers checkout API).
 *
 * State stored in SecureStore so it survives app kills.
 */

import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { callApi } from './api/apiClient';
import { getDistanceFromLatLonInMeters } from '../utils/locationUtils';
import { sendDeviceNotification, addNotification } from './NotificationService';
import { startActivePolling } from './LocationService';
import { queueOfflineAttendanceAction } from './AttendanceService';
import {
    clearPendingAttendanceRecovery,
    isLikelyNetworkError,
    queueAttendanceRecovery,
    queueAttendanceRecoveryFromError,
} from './AttendanceRecoveryService';

// ── Constants ─────────────────────────────────────────────────────────────────

const GEOFENCE_RADIUS_M          = 500;   // Must match LocationService registration
const DWELL_CONFIRM_DELAY_MS     = 5 * 60 * 1000;   // 5 min dwell before check-in
const DWELL_RECOVERY_TIMEOUT_MS  = 30 * 60 * 1000;  // after this, ask the user to recover manually
const EXIT_CONFIRM_SAMPLES_NEEDED = 2;               // both samples must be outside
const EXIT_POLLING_TIMEOUT_MS    = 15 * 60 * 1000;  // give up after 15 min
const FAR_DISTANCE_M             = 1500;             // fast exit if very far

// ── Persisted State ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'officeorbit_automation_state_v2';

type AutomationState = {
    pendingEnterAt      : number | null;   // ms timestamp when ENTER event fired
    exitPollingStartMs  : number | null;   // ms timestamp when exit polling started
    outsideSamplesCount : number;          // consecutive outside samples during exit confirm
};

const DEFAULT_STATE: AutomationState = {
    pendingEnterAt      : null,
    exitPollingStartMs  : null,
    outsideSamplesCount : 0,
};

const loadState = async (): Promise<AutomationState> => {
    try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_STATE };
        return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_STATE };
    }
};

const saveState = async (state: AutomationState): Promise<void> => {
    try {
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
    } catch { /* proceed without persistence */ }
};

const clearState = async (): Promise<void> => saveState({ ...DEFAULT_STATE });

// ── Profile / Day helpers ─────────────────────────────────────────────────────

type OfficeLoc = { latitude: number; longitude: number };

const OFFICE_CACHE_KEY = 'officeorbit_office_location_cache';

const fetchOfficeLocation = async (): Promise<OfficeLoc | null> => {
    try {
        // 1. Attempt to read from local SecureStore cache (instant, offline-first)
        const cached = await SecureStore.getItemAsync(OFFICE_CACHE_KEY);
        if (cached) {
            return JSON.parse(cached) as OfficeLoc;
        }
    } catch (_e) {
        // Ignore read failure
    }

    // 2. Fall back to network call if cache is missing (fallback only)
    const { data: profile, error } = await callApi<{ company_location: OfficeLoc | null }>('profile-get');
    if (error || !profile?.company_location) return null;

    // Cache the retrieved coordinates locally
    try {
        await SecureStore.setItemAsync(OFFICE_CACHE_KEY, JSON.stringify(profile.company_location));
    } catch (_e) {
        // Ignore storage failure
    }

    return profile.company_location;
};

const isWeekend = (): boolean => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
};

const getCurrentPosition = async (): Promise<Location.LocationObject | null> => {
    try {
        return await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
    } catch {
        return null;
    }
};

// ── Main Handlers ─────────────────────────────────────────────────────────────

/**
 * Called immediately when the OS fires a GEOFENCE_ENTER event.
 *
 * Strategy: Don't check in immediately. Store the pending enter timestamp
 * and take a confirming GPS sample after DWELL_CONFIRM_DELAY_MS (5 min).
 * This filters out bike/car pass-bys that cross the 500m fence briefly.
 *
 * Note: Background tasks in React Native can't reliably use setTimeout.
 * We immediately start ACTIVE_POLLING_TASK which samples GPS every 3 min.
 * When the polling task runs, it checks if 5 min has passed since pendingEnterAt.
 * If the user is still inside, it confirms check-in and stops the polling task.
 */
export async function handleGeofenceEnter(): Promise<void> {
    if (isWeekend()) return;

    const state = await loadState();
    const nowMs = Date.now();

    // Already have a pending enter — ignore duplicate ENTER events (GPS flicker)
    if (state.pendingEnterAt) return;

    // Clear any stale exit state
    state.exitPollingStartMs  = null;
    state.outsideSamplesCount = 0;
    state.pendingEnterAt      = nowMs;
    await saveState(state);

    // Check today's record — if already manual-override, skip
    const { data: todayRecord } = await callApi<{ is_manual_override?: boolean }>('attendance-today');
    if ((todayRecord as any)?.is_manual_override) return;

    // Schedule dwell confirmation: take a GPS sample now.
    // If we're still inside after 5 min, confirm.
    // We start the active polling task so the app wakes up to do this check.
    await confirmDwellIfReady(state);
    
    if (state.pendingEnterAt) {
        await startActivePolling();
    }
}

/**
 * Internal: checks if 5-min dwell has passed and user is still inside.
 * If yes → calls check-in API and fires notifications.
 * Returns true if the dwell was confirmed or cancelled (meaning we can stop polling for it).
 */
export async function confirmDwellIfReady(
    state?: AutomationState,
    sample?: Location.LocationObject | null,
): Promise<boolean> {
    if (!state) state = await loadState();
    if (!state.pendingEnterAt) return false;

    const nowMs  = Date.now();
    const dwellMs = nowMs - state.pendingEnterAt;

    if (dwellMs < DWELL_CONFIRM_DELAY_MS) {
        // Not enough time has passed yet — wait for next wake
        return false;
    }

    // Reuse the polling sample when available so we don't depend on a second GPS fetch
    const pos = sample ?? await getCurrentPosition();
    if (!pos) {
        if (dwellMs >= DWELL_RECOVERY_TIMEOUT_MS) {
            await queueAttendanceRecovery({
                action: 'checkin',
                source: 'auto',
                reason: 'location_unavailable',
            });
            await clearState();
            return true;
        }
        return false;
    }

    const office = await fetchOfficeLocation();
    if (!office) {
        await queueAttendanceRecovery({
            action: 'checkin',
            source: 'auto',
            reason: 'office_location_missing',
        });
        await clearState();
        return true;
    }

    const distance = getDistanceFromLatLonInMeters(
        pos.coords.latitude, pos.coords.longitude,
        office.latitude, office.longitude,
    );

    if (distance > GEOFENCE_RADIUS_M) {
        // User has already left — was a pass-by
        await clearState();
        return true;
    }

    // ✅ Confirmed: user is still inside after 5 min → check in
    state.pendingEnterAt = null;
    await saveState(state);

    const checkInPayload = {
        location: {
            latitude : pos.coords.latitude,
            longitude: pos.coords.longitude,
            address  : 'Auto-Detected at Office',
        },
        status: 'present',
        source: 'geofence',
    };

    const { error } = await callApi('check-in', checkInPayload);

    if (error) {
        if (isLikelyNetworkError(error)) {
            await queueOfflineAttendanceAction('checkin', checkInPayload);
            await queueAttendanceRecoveryFromError({
                action: 'checkin',
                source: 'auto',
                errorMessage: error,
                fallbackReason: 'network_error',
                queuedOffline: true,
            });
            return true;
        }

        await queueAttendanceRecoveryFromError({
            action: 'checkin',
            source: 'auto',
            errorMessage: error,
            fallbackReason: 'api_failed',
        });
        await addNotification({
            title: 'Auto check-in failed',
            body : error || 'Could not mark attendance automatically.',
            type : 'automation',
        });
    } else {
        await clearPendingAttendanceRecovery('checkin');
        // ✅ Fire BOTH device push + in-app notification
        await sendDeviceNotification(
            '🏢 Arrived at Office',
            'You\'ve been checked in automatically. Have a great day!',
        );
        await addNotification({
            title: 'Checked in to Office',
            body : 'Attendance marked automatically when you arrived.',
            type : 'automation',
        });
    }
    
    return true; // Finished processing the dwell
}

/**
 * Called when the OS fires a GEOFENCE_EXIT event.
 *
 * Starts exit confirmation polling (EXIT_CONFIRM_TASK).
 * The poller will call handleExitConfirmSample() every ~3 min.
 */
export async function handleGeofenceExit(): Promise<void> {
    if (isWeekend()) return;

    // Check today's record
    const { data: todayRecord } = await callApi<any>('attendance-today');
    if (!todayRecord) return;                              // never checked in
    if ((todayRecord as any)?.is_manual_override) return;  // manual day — don't touch
    if (todayRecord.check_out) return;                     // already fully checked out

    // Clear any pending enter (exit fires after enter — discard drive-by)
    const state = await loadState();
    if (state.pendingEnterAt) {
        const dwellMs = Date.now() - state.pendingEnterAt;
        if (dwellMs < DWELL_CONFIRM_DELAY_MS) {
            // Left before 5-min dwell — was a pass-by, never actually checked in
            await clearState();
            return;
        }
    }

    // If no open session exists (user was never confirmed inside), skip
    const { data: sessionData } = await callApi<any>('session-status');
    if (!sessionData?.is_inside) return;

    // Start exit confirmation polling
    state.exitPollingStartMs  = Date.now();
    state.outsideSamplesCount = 0;
    state.pendingEnterAt      = null;
    await saveState(state);

    await startActivePolling();
}

/**
 * Called by ACTIVE_POLLING_TASK every ~3 min with a fresh GPS sample.
 *
 * Checks if we need to confirm Dwell OR Exit.
 * Returns true when polling is no longer needed (caller should stop the polling task).
 */
export async function handleActivePollingSample(
    sample: Location.LocationObject,
): Promise<boolean> {
    if (isWeekend()) return true;

    const state = await loadState();
    const nowMs = Date.now();
    
    let finishedDwell = false;
    
    // 1. Process pending Enter Dwell if it exists
    if (state.pendingEnterAt) {
        finishedDwell = await confirmDwellIfReady(state, sample);
    }

    // 2. Process Exit Polling if it exists
    if (!state.exitPollingStartMs) {
        // If we don't have an exit polling active, and we finished the dwell, we can stop polling.
        return finishedDwell || !state.pendingEnterAt;
    }

    // Timeout guard for Exit Polling
    if (
        state.exitPollingStartMs &&
        nowMs - state.exitPollingStartMs > EXIT_POLLING_TIMEOUT_MS
    ) {
        await clearState();
        return true; // stop polling
    }

    const office = await fetchOfficeLocation();
    if (!office) return false;

    const distance = getDistanceFromLatLonInMeters(
        sample.coords.latitude, sample.coords.longitude,
        office.latitude, office.longitude,
    );

    const isInside   = distance <= GEOFENCE_RADIUS_M;
    const isFarAway  = distance >= FAR_DISTANCE_M;

    if (isInside) {
        // User came back — cancel exit confirmation, re-enter flow
        state.outsideSamplesCount = 0;
        state.exitPollingStartMs  = null;
        state.pendingEnterAt      = Date.now(); // treat as re-entry
        await saveState(state);
        return true; // stop exit confirm polling
    }

    if (isFarAway) {
        // Clearly left — single far sample is enough
        await performCheckout(sample);
        await clearState();
        return true;
    }

    // Outside but not far — accumulate samples
    state.outsideSamplesCount = (state.outsideSamplesCount ?? 0) + 1;
    await saveState(state);

    if (state.outsideSamplesCount >= EXIT_CONFIRM_SAMPLES_NEEDED) {
        await performCheckout(sample);
        await clearState();
        return true;
    }

    return false; // need more samples
}

// ── Checkout helper ───────────────────────────────────────────────────────────

async function performCheckout(sample?: Location.LocationObject): Promise<void> {
    const checkoutPayload = {
        source: 'geofence',
    };
    const { data: result, error, message } = await callApi<any>('check-out', checkoutPayload);

    if (error) {
        if (isLikelyNetworkError(error)) {
            await queueOfflineAttendanceAction('checkout', checkoutPayload);
            await queueAttendanceRecoveryFromError({
                action: 'checkout',
                source: 'auto',
                errorMessage: error,
                fallbackReason: 'network_error',
                queuedOffline: true,
            });
            return;
        }

        await queueAttendanceRecoveryFromError({
            action: 'checkout',
            source: 'auto',
            errorMessage: error,
            fallbackReason: 'api_failed',
        });
        await addNotification({
            title: 'Auto check-out failed',
            body : error || 'Could not mark departure automatically.',
            type : 'automation',
        });
        return;
    }

    await clearPendingAttendanceRecovery('checkout');

    // Build a friendly duration string from the message or result
    const totalMinutes : number = result?.total_minutes ?? result?.duration_minutes ?? 0;
    const hrs  = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    const status: string = result?.status ?? 'present';
    const statusLabel = status === 'present' ? '✅ Present' : status === 'wfh' ? '🏠 WFH' : '❌ Absent';

    // ✅ Fire BOTH device push + in-app notification
    await sendDeviceNotification(
        `${statusLabel} — ${durationStr} logged today`,
        status === 'present'
            ? `Great work! You've met today's attendance requirement.`
            : status === 'wfh'
            ? `You were in office for ${durationStr}. Day marked as Work From Home.`
            : `Only ${durationStr} logged. Attendance marked absent.`,
    );

    await addNotification({
        title: `Checked out — ${durationStr} today`,
        body : `Status: ${statusLabel}. ${message ?? ''}`.trim(),
        type : 'automation',
    });
}
