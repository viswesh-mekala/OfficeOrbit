// ── Mocks (inline factories required — jest.mock is hoisted before variables) ─
// Jest ALLOWS variables prefixed with 'mock' in factory closures.

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

jest.mock('../../src/services/api/supabaseClient', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-123' } } }) },
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  addNotification: jest.fn(),
  sendDeviceNotification: jest.fn(),
  subscribeNotifications: jest.fn(() => jest.fn()),
  getUnreadCount: jest.fn(() => 0),
}));

import * as SecureStore from 'expo-secure-store';
import {
  queueAttendanceRecovery,
  queueAttendanceRecoveryFromError,
  clearPendingAttendanceRecovery,
  getPendingAttendanceRecovery,
  subscribeAttendanceRecovery,
  isLikelyNetworkError,
  inferAttendanceRecoveryReason,
} from '../../src/services/AttendanceRecoveryService';
import * as NotificationService from '../../src/services/NotificationService';

const mockAddNotification = NotificationService.addNotification as jest.Mock;
const mockSendDeviceNotification = NotificationService.sendDeviceNotification as jest.Mock;

// ── Setup ─────────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-123';
const STORAGE_KEY = `officeorbit_attendance_recovery_v1_${USER_ID}`;

beforeEach(() => {
  mockStore.clear();
  (mockAddNotification as jest.Mock).mockReset();
  (mockSendDeviceNotification as jest.Mock).mockReset();
  jest.useFakeTimers().setSystemTime(new Date('2026-05-10T08:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── isLikelyNetworkError ──────────────────────────────────────────────────────

describe('isLikelyNetworkError', () => {
  test.each([
    ['Network error please try again', true],
    ['connection refused', true],
    ['internet not available', true],
    ['offline mode', true],
    ['timeout waiting for server', true],
    ['Failed to fetch', true],
    ['fetch error', true],
    ['Profile not found', false],
    ['Invalid location data', false],
    ['user already registered', false],
    [null, false],
    [undefined, false],
    ['', false],
  ])('"%s" → %s', (msg: string | null | undefined, expected: boolean) => {
    expect(isLikelyNetworkError(msg)).toBe(expected);
  });
});

// ── inferAttendanceRecoveryReason ─────────────────────────────────────────────

describe('inferAttendanceRecoveryReason', () => {
  test('maps network message → network_error', () => {
    expect(inferAttendanceRecoveryReason('network request failed')).toBe('network_error');
  });

  test('maps "too far from office" → verification_failed', () => {
    expect(inferAttendanceRecoveryReason('You are too far from office.')).toBe('verification_failed');
  });

  test('maps "invalid location" → location_unavailable', () => {
    expect(inferAttendanceRecoveryReason('invalid location data')).toBe('location_unavailable');
  });

  test('maps "location is off" → location_off', () => {
    expect(inferAttendanceRecoveryReason('location is off')).toBe('location_off');
  });

  test('maps "office location" → office_location_missing', () => {
    expect(inferAttendanceRecoveryReason('no office location set')).toBe('office_location_missing');
  });

  test('uses fallback for unknown messages', () => {
    expect(inferAttendanceRecoveryReason('something weird', 'api_failed')).toBe('api_failed');
  });

  test('uses default fallback api_failed when no fallback arg', () => {
    expect(inferAttendanceRecoveryReason('some random error')).toBe('api_failed');
  });
});

// ── queueAttendanceRecovery ───────────────────────────────────────────────────

describe('queueAttendanceRecovery', () => {
  test('creates recovery for checkin + network_error and writes to SecureStore', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'manual',
      reason: 'network_error',
    });

    expect(recovery.action).toBe('checkin');
    expect(recovery.source).toBe('manual');
    expect(recovery.reason).toBe('network_error');
    expect(recovery.requiresSettings).toBe(false);
    expect(recovery.allowManualFallback).toBe(true);
    expect(recovery.route).toBe('/dashboard');

    const stored = await getPendingAttendanceRecovery();
    expect(stored?.action).toBe('checkin');
  });

  test('creates recovery for location_permission with requiresSettings=true', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'auto',
      reason: 'location_permission',
    });

    expect(recovery.requiresSettings).toBe(true);
  });

  test('creates recovery for location_off with requiresSettings=true', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'manual',
      reason: 'location_off',
    });

    expect(recovery.requiresSettings).toBe(true);
  });

  test('creates recovery for background_location_permission with requiresSettings=true', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'auto',
      reason: 'background_location_permission',
    });

    expect(recovery.requiresSettings).toBe(true);
  });

  test('fires addNotification and sendDeviceNotification on new recovery', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'api_failed' });

    expect(mockAddNotification).toHaveBeenCalledTimes(1);
    expect(mockSendDeviceNotification).toHaveBeenCalledTimes(1);
  });

  test('sendDeviceNotification includes route and recovery params', async () => {
    await queueAttendanceRecovery({ action: 'checkout', source: 'auto', reason: 'api_failed' });

    expect(mockSendDeviceNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        route: '/dashboard',
        params: expect.objectContaining({
          recovery: '1',
          recoveryAction: 'checkout',
        }),
      }),
    );
  });

  test('de-duplicates within 15-minute window (same action + reason)', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'network_error' });
    const secondResult = await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'network_error' });

    // Should return existing without calling notifications again
    expect(mockAddNotification).toHaveBeenCalledTimes(1);
    expect(mockSendDeviceNotification).toHaveBeenCalledTimes(1);
  });

  test('does NOT de-duplicate when action is different', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'network_error' });
    await queueAttendanceRecovery({ action: 'checkout', source: 'manual', reason: 'network_error' });

    expect(mockAddNotification).toHaveBeenCalledTimes(2);
  });

  test('preserves detail field when provided', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'auto',
      reason: 'api_failed',
      detail: 'Edge function timed out',
    });

    expect(recovery.detail).toBe('Edge function timed out');
  });

  test('sets queuedOffline=true when flag is passed', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'auto',
      reason: 'network_error',
      queuedOffline: true,
    });

    expect(recovery.queuedOffline).toBe(true);
    // Title should mention "queued offline"
    expect(recovery.title.toLowerCase()).toContain('queue');
  });

  test('title changes for checkout action', async () => {
    const recovery = await queueAttendanceRecovery({
      action: 'checkout',
      source: 'manual',
      reason: 'api_failed',
    });

    expect(recovery.title.toLowerCase()).toContain('check-out');
  });

  test('title is different for auto vs manual source on location_unavailable', async () => {
    // Clear between calls so dedup doesn't trigger
    mockStore.clear();
    const autoRecovery = await queueAttendanceRecovery({
      action: 'checkin',
      source: 'auto',
      reason: 'location_unavailable',
    });
    expect(autoRecovery.title.toLowerCase()).toContain('automatic');
  });
});

// ── clearPendingAttendanceRecovery ────────────────────────────────────────────

describe('clearPendingAttendanceRecovery', () => {
  test('removes stored recovery when called without action', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'api_failed' });
    await clearPendingAttendanceRecovery();

    const stored = await getPendingAttendanceRecovery();
    expect(stored).toBeNull();
  });

  test('removes stored recovery when called with matching action', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'api_failed' });
    await clearPendingAttendanceRecovery('checkin');

    const stored = await getPendingAttendanceRecovery();
    expect(stored).toBeNull();
  });

  test('does NOT remove when action does NOT match', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'api_failed' });
    await clearPendingAttendanceRecovery('checkout'); // mismatch

    const stored = await getPendingAttendanceRecovery();
    expect(stored?.action).toBe('checkin'); // still there
  });

  test('is a no-op when no recovery exists', async () => {
    await expect(clearPendingAttendanceRecovery()).resolves.not.toThrow();
  });
});

// ── queueAttendanceRecoveryFromError ──────────────────────────────────────────

describe('queueAttendanceRecoveryFromError', () => {
  test('infers network_error from network message', async () => {
    const recovery = await queueAttendanceRecoveryFromError({
      action: 'checkin',
      source: 'manual',
      errorMessage: 'Network request failed',
      fallbackReason: 'api_failed',
    });

    expect(recovery.reason).toBe('network_error');
  });

  test('uses fallbackReason when message does not match any pattern', async () => {
    const recovery = await queueAttendanceRecoveryFromError({
      action: 'checkin',
      source: 'auto',
      errorMessage: 'Some random server error',
      fallbackReason: 'api_failed',
    });

    expect(recovery.reason).toBe('api_failed');
  });

  test('sets queuedOffline flag on recovery when passed', async () => {
    const recovery = await queueAttendanceRecoveryFromError({
      action: 'checkin',
      source: 'auto',
      errorMessage: 'Network request failed',
      fallbackReason: 'network_error',
      queuedOffline: true,
    });

    expect(recovery.queuedOffline).toBe(true);
  });

  test('handles null errorMessage gracefully', async () => {
    await expect(
      queueAttendanceRecoveryFromError({
        action: 'checkout',
        source: 'auto',
        errorMessage: null,
        fallbackReason: 'api_failed',
      }),
    ).resolves.not.toThrow();
  });
});

// ── subscribeAttendanceRecovery ───────────────────────────────────────────────

describe('subscribeAttendanceRecovery', () => {
  test('calls listener immediately with current state (null when empty)', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAttendanceRecovery(listener);

    // Flush the async initial read (uses setTimeout(0) internally)
    await jest.runAllTimersAsync();

    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();
  });

  test('calls listener when a new recovery is queued', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAttendanceRecovery(listener);

    await jest.runAllTimersAsync();
    listener.mockClear();

    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'api_failed' });

    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(lastCall?.action).toBe('checkin');
    unsubscribe();
  });

  test('calls listener with null when recovery is cleared', async () => {
    await queueAttendanceRecovery({ action: 'checkin', source: 'manual', reason: 'api_failed' });

    const listener = jest.fn();
    const unsubscribe = subscribeAttendanceRecovery(listener);
    await jest.runAllTimersAsync();
    listener.mockClear();

    await clearPendingAttendanceRecovery();
    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();
  });
});


// ── getPendingAttendanceRecovery ──────────────────────────────────────────────

describe('getPendingAttendanceRecovery', () => {
  test('returns null when nothing is stored', async () => {
    const result = await getPendingAttendanceRecovery();
    expect(result).toBeNull();
  });

  test('returns stored recovery after queueing', async () => {
    await queueAttendanceRecovery({ action: 'checkout', source: 'auto', reason: 'verification_failed' });
    const result = await getPendingAttendanceRecovery();

    expect(result?.action).toBe('checkout');
    expect(result?.reason).toBe('verification_failed');
  });

  test('returns null for corrupt stored JSON (safeParse handles it)', async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, 'invalid json {{}}');
    const result = await getPendingAttendanceRecovery();
    expect(result).toBeNull();
  });

  test('returns null for stored object missing id field', async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ action: 'checkin' }));
    const result = await getPendingAttendanceRecovery();
    expect(result).toBeNull();
  });
});
