import * as SecureStore from 'expo-secure-store';
import { supabase } from './api/supabaseClient';
import {
    addNotification,
    AppNotificationType,
    sendDeviceNotification,
} from './NotificationService';

const STORAGE_KEY_PREFIX = 'officeorbit_attendance_recovery_v1';
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;

export type AttendanceRecoveryAction = 'checkin' | 'checkout';
export type AttendanceRecoverySource = 'auto' | 'manual';
export type AttendanceRecoveryReason =
    | 'location_permission'
    | 'background_location_permission'
    | 'location_off'
    | 'location_unavailable'
    | 'network_error'
    | 'verification_failed'
    | 'api_failed'
    | 'office_location_missing';

export interface PendingAttendanceRecovery {
    id: string;
    action: AttendanceRecoveryAction;
    source: AttendanceRecoverySource;
    reason: AttendanceRecoveryReason;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    detail: string | null;
    queuedOffline: boolean;
    requiresSettings: boolean;
    allowManualFallback: boolean;
    route: '/dashboard';
}

type RecoveryListener = (recovery: PendingAttendanceRecovery | null) => void;

type QueueAttendanceRecoveryInput = {
    action: AttendanceRecoveryAction;
    source: AttendanceRecoverySource;
    reason: AttendanceRecoveryReason;
    detail?: string | null;
    queuedOffline?: boolean;
};

type RecoveryCopy = {
    title: string;
    body: string;
    type: AppNotificationType;
    requiresSettings: boolean;
    allowManualFallback: boolean;
};

const listeners = new Set<RecoveryListener>();

const notifyListeners = (recovery: PendingAttendanceRecovery | null) => {
    listeners.forEach((listener) => listener(recovery));
};

const getStorageKey = async () => {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : `${STORAGE_KEY_PREFIX}_guest`;
};

const safeParse = (raw: string | null): PendingAttendanceRecovery | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.id !== 'string') return null;
        return {
            id: String(parsed.id),
            action: parsed.action === 'checkout' ? 'checkout' : 'checkin',
            source: parsed.source === 'manual' ? 'manual' : 'auto',
            reason: parsed.reason ?? 'api_failed',
            title: String(parsed.title ?? ''),
            body: String(parsed.body ?? ''),
            createdAt: String(parsed.createdAt ?? new Date().toISOString()),
            updatedAt: String(parsed.updatedAt ?? parsed.createdAt ?? new Date().toISOString()),
            detail: parsed.detail ? String(parsed.detail) : null,
            queuedOffline: Boolean(parsed.queuedOffline),
            requiresSettings: Boolean(parsed.requiresSettings),
            allowManualFallback: parsed.allowManualFallback !== false,
            route: '/dashboard',
        };
    } catch {
        return null;
    }
};

const saveRecovery = async (recovery: PendingAttendanceRecovery | null) => {
    const storageKey = await getStorageKey();
    if (!recovery) {
        await SecureStore.deleteItemAsync(storageKey);
        notifyListeners(null);
        return;
    }

    await SecureStore.setItemAsync(storageKey, JSON.stringify(recovery));
    notifyListeners(recovery);
};

export const getPendingAttendanceRecovery = async (): Promise<PendingAttendanceRecovery | null> => {
    const storageKey = await getStorageKey();
    const raw = await SecureStore.getItemAsync(storageKey);
    return safeParse(raw);
};

export const subscribeAttendanceRecovery = (listener: RecoveryListener) => {
    listeners.add(listener);
    getPendingAttendanceRecovery().then(listener).catch(() => listener(null));
    return () => {
        listeners.delete(listener);
    };
};

export const clearPendingAttendanceRecovery = async (
    action?: AttendanceRecoveryAction,
) => {
    const existing = await getPendingAttendanceRecovery();
    if (!existing) return;
    if (action && existing.action !== action) return;
    await saveRecovery(null);
};

const buildRecoveryCopy = (
    input: QueueAttendanceRecoveryInput,
): RecoveryCopy => {
    const actionLabel = input.action === 'checkin' ? 'check-in' : 'check-out';
    const autoPrefix = input.source === 'auto' ? 'Automatic ' : '';

    switch (input.reason) {
        case 'location_permission':
            return {
                title: 'Location permission needed',
                body: `Open OfficeOrbit and allow location access to finish ${actionLabel}. Manual swipe is still available.`,
                type: 'location',
                requiresSettings: true,
                allowManualFallback: true,
            };
        case 'background_location_permission':
            return {
                title: 'Background location needed',
                body: 'Allow "all the time" location access to keep automatic office attendance working reliably.',
                type: 'location',
                requiresSettings: true,
                allowManualFallback: true,
            };
        case 'location_off':
            return {
                title: 'Turn on location services',
                body: `Location is turned off, so we could not complete ${actionLabel}. Open OfficeOrbit after enabling location, or use manual swipe.`,
                type: 'location',
                requiresSettings: true,
                allowManualFallback: true,
            };
        case 'location_unavailable':
            return {
                title: `${autoPrefix}${input.action === 'checkin' ? 'Arrival' : 'departure'} needs confirmation`,
                body: `We could not verify your location for ${actionLabel}. Open OfficeOrbit to retry, or use manual swipe if needed.`,
                type: 'location',
                requiresSettings: false,
                allowManualFallback: true,
            };
        case 'network_error':
            return {
                title: input.queuedOffline
                    ? `${autoPrefix}${input.action === 'checkin' ? 'Check-in' : 'check-out'} queued offline`
                    : 'Network interrupted attendance',
                body: input.queuedOffline
                    ? `We saved your ${actionLabel} and will retry when the app reconnects. Open OfficeOrbit if you want to review it now.`
                    : `We could not reach the network to complete ${actionLabel}. Open OfficeOrbit to retry, or use manual swipe.`,
                type: 'automation',
                requiresSettings: false,
                allowManualFallback: true,
            };
        case 'verification_failed':
            return {
                title: `${autoPrefix}${input.action === 'checkin' ? 'Office arrival' : 'office departure'} could not be confirmed`,
                body: `We detected movement around the office, but could not safely confirm ${actionLabel}. Open OfficeOrbit to complete it manually.`,
                type: 'automation',
                requiresSettings: false,
                allowManualFallback: true,
            };
        case 'office_location_missing':
            return {
                title: 'Office location missing',
                body: 'Set your office location in OfficeOrbit before automatic attendance can work.',
                type: 'system',
                requiresSettings: false,
                allowManualFallback: true,
            };
        case 'api_failed':
        default:
            return {
                title: `${autoPrefix}${input.action === 'checkin' ? 'Check-in' : 'check-out'} needs your attention`,
                body: `We could not complete ${actionLabel}. Open OfficeOrbit to retry or use manual swipe.`,
                type: 'attendance',
                requiresSettings: false,
                allowManualFallback: true,
            };
    }
};

export const isLikelyNetworkError = (message?: string | null): boolean => {
    const normalized = (message ?? '').toLowerCase();
    return (
        normalized.includes('network') ||
        normalized.includes('connection') ||
        normalized.includes('internet') ||
        normalized.includes('offline') ||
        normalized.includes('timeout') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('fetch')
    );
};

export const inferAttendanceRecoveryReason = (
    message: string | null | undefined,
    fallback: AttendanceRecoveryReason = 'api_failed',
): AttendanceRecoveryReason => {
    const normalized = (message ?? '').toLowerCase();

    if (isLikelyNetworkError(normalized)) return 'network_error';
    if (normalized.includes('too far from office')) return 'verification_failed';
    if (normalized.includes('invalid location')) return 'location_unavailable';
    if (normalized.includes('location is off')) return 'location_off';
    if (normalized.includes('office location')) return 'office_location_missing';

    return fallback;
};

export const queueAttendanceRecovery = async (
    input: QueueAttendanceRecoveryInput,
): Promise<PendingAttendanceRecovery> => {
    const existing = await getPendingAttendanceRecovery();
    const now = new Date();
    const copy = buildRecoveryCopy(input);

    if (
        existing &&
        existing.action === input.action &&
        existing.reason === input.reason &&
        now.getTime() - new Date(existing.updatedAt).getTime() < DEDUPE_WINDOW_MS
    ) {
        return existing;
    }

    const recovery: PendingAttendanceRecovery = {
        id: `${now.getTime()}_${Math.random().toString(36).slice(2, 10)}`,
        action: input.action,
        source: input.source,
        reason: input.reason,
        title: copy.title,
        body: copy.body,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
        detail: input.detail ?? null,
        queuedOffline: Boolean(input.queuedOffline),
        requiresSettings: copy.requiresSettings,
        allowManualFallback: copy.allowManualFallback,
        route: '/dashboard',
    };

    await saveRecovery(recovery);
    await addNotification({
        title: recovery.title,
        body: recovery.body,
        type: copy.type,
    });
    await sendDeviceNotification(recovery.title, recovery.body, {
        route: recovery.route,
        params: {
            recovery: '1',
            recoveryAction: recovery.action,
            recoveryId: recovery.id,
        },
    });

    return recovery;
};

export const queueAttendanceRecoveryFromError = async (input: {
    action: AttendanceRecoveryAction;
    source: AttendanceRecoverySource;
    errorMessage?: string | null;
    fallbackReason?: AttendanceRecoveryReason;
    queuedOffline?: boolean;
}) => {
    const reason = inferAttendanceRecoveryReason(
        input.errorMessage,
        input.fallbackReason ?? 'api_failed',
    );
    return queueAttendanceRecovery({
        action: input.action,
        source: input.source,
        reason,
        detail: input.errorMessage ?? null,
        queuedOffline: input.queuedOffline,
    });
};
