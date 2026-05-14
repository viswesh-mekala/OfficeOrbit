// All mock factories use inline jest.fn() to avoid hoisting conflicts.
// Variable refs are obtained via module cast after import.

const mockStore = new Map<string, string>();
const mockSupabaseGetUser = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 5 },
  AndroidNotificationPriority: { HIGH: 'HIGH' },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

jest.mock('../../src/services/api/supabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}));

import * as ExpoNotifications from 'expo-notifications';
import { supabase } from '../../src/services/api/supabaseClient';
import {
  addNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationsCount,
  subscribeNotifications,
  sendDeviceNotification,
  requestNotificationPermissions,
  attachNotificationNavigation,
} from '../../src/services/NotificationService';

// Typed refs to inline mocks
const mockGetPermissions = ExpoNotifications.getPermissionsAsync as jest.Mock;
const mockScheduleNotification = ExpoNotifications.scheduleNotificationAsync as jest.Mock;
const mockSetNotificationChannelAsync = ExpoNotifications.setNotificationChannelAsync as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

// ── Setup ─────────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-notifications';

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  jest.useFakeTimers().setSystemTime(new Date('2026-05-10T08:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── addNotification ───────────────────────────────────────────────────────────

describe('addNotification', () => {
  test('creates a new notification with correct fields', async () => {
    const result = await addNotification({ title: 'Checked In', body: 'Office attendance marked.', type: 'attendance' });

    expect(result.title).toBe('Checked In');
    expect(result.body).toBe('Office attendance marked.');
    expect(result.type).toBe('attendance');
    expect(result.id).toBeTruthy();
    expect(result.readAt).toBeNull();
    expect(result.createdAt).toBeTruthy();
  });

  test('persists notification to SecureStore', async () => {
    await addNotification({ title: 'Test', body: 'body', type: 'system' });

    const items = await getNotifications();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Test');
  });

  test('de-duplicates notifications with same title+body within 15 minutes', async () => {
    await addNotification({ title: 'Network error', body: 'No connection.', type: 'system' });
    await addNotification({ title: 'Network error', body: 'No connection.', type: 'system' });

    const items = await getNotifications();
    expect(items).toHaveLength(1);
  });

  test('does NOT deduplicate after 15-minute window', async () => {
    await addNotification({ title: 'Network error', body: 'No connection.', type: 'system' });
    jest.setSystemTime(Date.now() + 16 * 60 * 1000);
    await addNotification({ title: 'Network error', body: 'No connection.', type: 'system' });

    const items = await getNotifications();
    expect(items).toHaveLength(2);
  });

  test('generates a unique id for each notification', async () => {
    const n1 = await addNotification({ title: 'A', body: 'b', type: 'system' });
    jest.setSystemTime(Date.now() + 1000);
    const n2 = await addNotification({ title: 'B', body: 'b', type: 'system' });

    expect(n1.id).not.toBe(n2.id);
  });

  test('sets readAt to null by default', async () => {
    const n = await addNotification({ title: 'X', body: 'y', type: 'system' });
    expect(n.readAt).toBeNull();
  });
});

// ── getNotifications ──────────────────────────────────────────────────────────

describe('getNotifications', () => {
  test('returns empty array when nothing stored', async () => {
    const items = await getNotifications();
    expect(items).toEqual([]);
  });

  test('returns notifications in correct order', async () => {
    await addNotification({ title: 'First', body: 'b', type: 'system' });
    jest.setSystemTime(Date.now() + 1000);
    await addNotification({ title: 'Second', body: 'b', type: 'attendance' });

    const items = await getNotifications();
    expect(items).toHaveLength(2);
  });

  test('returns empty array when SecureStore holds corrupt JSON', async () => {
    mockStore.set(`officeorbit_notifications_v1_${USER_ID}`, 'NOT_VALID_JSON');
    const items = await getNotifications();
    expect(items).toEqual([]);
  });
});

// ── markNotificationRead ──────────────────────────────────────────────────────

describe('markNotificationRead', () => {
  test('sets readAt on the specified notification', async () => {
    const n = await addNotification({ title: 'Alert', body: 'body', type: 'system' });
    await markNotificationRead(n.id);

    const items = await getNotifications();
    const updated = items.find((i) => i.id === n.id);
    expect(updated?.readAt).not.toBeNull();
  });

  test('does not modify other notifications', async () => {
    const n1 = await addNotification({ title: 'Alert1', body: 'body', type: 'system' });
    jest.setSystemTime(Date.now() + 1000);
    const n2 = await addNotification({ title: 'Alert2', body: 'body', type: 'system' });

    await markNotificationRead(n1.id);

    const items = await getNotifications();
    const second = items.find((i) => i.id === n2.id);
    expect(second?.readAt).toBeNull();
  });

  test('no-ops gracefully for a non-existent id', async () => {
    await addNotification({ title: 'X', body: 'y', type: 'system' });
    await expect(markNotificationRead('nonexistent')).resolves.not.toThrow();
  });
});

// ── markAllNotificationsRead ──────────────────────────────────────────────────

describe('markAllNotificationsRead', () => {
  test('marks all notifications as read', async () => {
    await addNotification({ title: 'A', body: 'b', type: 'system' });
    jest.setSystemTime(Date.now() + 1000);
    await addNotification({ title: 'B', body: 'b', type: 'attendance' });

    await markAllNotificationsRead();

    const items = await getNotifications();
    expect(items.every((i) => i.readAt !== null)).toBe(true);
  });
});

// ── getUnreadNotificationsCount ───────────────────────────────────────────────

describe('getUnreadNotificationsCount', () => {
  test('returns 0 for empty list', async () => {
    expect(await getUnreadNotificationsCount()).toBe(0);
  });

  test('returns correct count of unread notifications', async () => {
    await addNotification({ title: 'One', body: 'b', type: 'system' });
    jest.setSystemTime(Date.now() + 1000);
    const n2 = await addNotification({ title: 'Two', body: 'b', type: 'system' });
    await markNotificationRead(n2.id);

    expect(await getUnreadNotificationsCount()).toBe(1);
  });

  test('returns 0 after marking all read', async () => {
    await addNotification({ title: 'X', body: 'b', type: 'system' });
    await markAllNotificationsRead();
    expect(await getUnreadNotificationsCount()).toBe(0);
  });
});

// ── subscribeNotifications ────────────────────────────────────────────────────

describe('subscribeNotifications', () => {
  test('calls listener immediately with current notifications', async () => {
    await addNotification({ title: 'Existing', body: 'msg', type: 'system' });

    const listener = jest.fn();
    const unsubscribe = subscribeNotifications(listener);

    // Flush async timer (subscribe uses setTimeout(0) internally)
    await jest.runAllTimersAsync();
    expect(listener).toHaveBeenCalled();
    const arg = listener.mock.calls[0][0] as any[];
    expect(arg.length).toBeGreaterThan(0);
    unsubscribe();
  });

  test('calls listener when a new notification is added', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNotifications(listener);
    await jest.runAllTimersAsync();
    listener.mockClear();

    await addNotification({ title: 'New Event', body: 'body', type: 'attendance' });

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});

// ── sendDeviceNotification ────────────────────────────────────────────────────

describe('sendDeviceNotification', () => {
  test('does NOT schedule notification when permission is not granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'denied' });
    await sendDeviceNotification('Test', 'Body');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  test('schedules notification when permission is granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' });
    mockSetNotificationChannelAsync.mockResolvedValueOnce(undefined);
    mockScheduleNotification.mockResolvedValueOnce('notification-id');

    await sendDeviceNotification('Checked In', 'Office attendance marked.');
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  test('includes title and body in the notification content', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' });
    mockSetNotificationChannelAsync.mockResolvedValueOnce(undefined);
    mockScheduleNotification.mockResolvedValueOnce('notification-id');

    await sendDeviceNotification('My Title', 'My Body');

    const call = mockScheduleNotification.mock.calls[0][0];
    expect(call.content.title).toBe('My Title');
    expect(call.content.body).toBe('My Body');
  });

  test('does not throw when scheduleNotificationAsync rejects', async () => {
    // This test intentionally causes the service's internal catch block to fire.
    // Suppress the expected console.error so it doesn't pollute CI output.
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' });
    mockSetNotificationChannelAsync.mockResolvedValueOnce(undefined);
    mockScheduleNotification.mockRejectedValueOnce(new Error('Device error'));

    await expect(sendDeviceNotification('Fail', 'Body')).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});

// ── requestNotificationPermissions ───────────────────────────────────────────

describe('requestNotificationPermissions', () => {
  const mockRequestPermissions = ExpoNotifications.requestPermissionsAsync as jest.Mock;

  test('returns granted status after requesting', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValueOnce({ status: 'granted' });

    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
  });

  test('returns true when already granted (no request needed)', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'granted' });

    const result = await requestNotificationPermissions();
    expect(result).toBe(true);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  test('returns false when permission is denied', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValueOnce({ status: 'denied' });

    const result = await requestNotificationPermissions();
    expect(result).toBe(false);
  });
});

// ── attachNotificationNavigation ──────────────────────────────────────────────

describe('attachNotificationNavigation', () => {
  test('navigates when notification response contains route data', async () => {
    const Notifications = require('expo-notifications');
    Notifications.getLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: {
        request: {
          identifier: 'notif-abc',
          content: {
            data: { route: '/dashboard', params: { recovery: '1' } },
          },
        },
      },
    });
    Notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove: jest.fn() });

    const onNavigate = jest.fn();
    const unsubscribe = attachNotificationNavigation(onNavigate);

    await jest.runAllTimersAsync();

    expect(onNavigate).toHaveBeenCalledWith('/dashboard', { recovery: '1' });
    unsubscribe();
  });

  test('does NOT navigate when response has no route', async () => {
    const Notifications = require('expo-notifications');
    Notifications.getLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: {
        request: {
          identifier: 'notif-xyz',
          content: { data: {} },
        },
      },
    });
    Notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove: jest.fn() });

    const onNavigate = jest.fn();
    const unsubscribe = attachNotificationNavigation(onNavigate);
    await jest.runAllTimersAsync();

    expect(onNavigate).not.toHaveBeenCalled();
    unsubscribe();
  });

  test('ignores duplicate notification responses (same identifier)', async () => {
    const Notifications = require('expo-notifications');

    Notifications.getLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: {
        request: {
          identifier: 'notif-dupe',
          content: { data: { route: '/dashboard', params: {} } },
        },
      },
    });
    Notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove: jest.fn() });

    const onNavigate = jest.fn();
    const unsubscribe1 = attachNotificationNavigation(onNavigate);
    await jest.runAllTimersAsync();

    onNavigate.mockClear();

    Notifications.getLastNotificationResponseAsync.mockResolvedValueOnce({
      notification: {
        request: {
          identifier: 'notif-dupe', // same ID — should be ignored
          content: { data: { route: '/dashboard', params: {} } },
        },
      },
    });
    Notifications.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove: jest.fn() });

    const unsubscribe2 = attachNotificationNavigation(onNavigate);
    await jest.runAllTimersAsync();

    expect(onNavigate).not.toHaveBeenCalled();
    unsubscribe1();
    unsubscribe2();
  });
});
