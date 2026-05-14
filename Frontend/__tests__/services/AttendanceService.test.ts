// Jest ALLOWS variables prefixed with 'mock' inside jest.mock() factory closures.
// The storage mock uses a Map; apiClient mock uses jest.fn() inline to avoid hoisting issues.

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

// Use inline jest.fn() for apiClient mock to avoid hoisting issues
jest.mock('../../src/services/api/apiClient', () => ({
  callApi: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import * as ApiClient from '../../src/services/api/apiClient';
import {
  queueOfflineAttendanceAction,
  flushOfflineQueue,
  clockIn,
  clockOut,
  getTodayAttendance,
  getWeeklyAttendance,
  getSessionStatus,
} from '../../src/services/AttendanceService';

const mockCallApi = ApiClient.callApi as jest.Mock;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore.clear();
  mockCallApi.mockReset();
  jest.useFakeTimers().setSystemTime(new Date('2026-05-10T08:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── queueOfflineAttendanceAction ──────────────────────────────────────────────

describe('queueOfflineAttendanceAction', () => {
  const QUEUE_KEY = 'officeorbit_attendance_queue_v1';

  test('adds a checkin action to an empty queue', async () => {
    const payload = { location: { latitude: 12.97, longitude: 77.59 }, status: 'present', source: 'geofence' };
    await queueOfflineAttendanceAction('checkin', payload);

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe('checkin');
    expect(queue[0].payload).toEqual(payload);
    expect(queue[0].id).toBeTruthy();
  });

  test('adds a checkout action', async () => {
    await queueOfflineAttendanceAction('checkout', { source: 'geofence' });

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    const queue = JSON.parse(raw!);
    expect(queue[0].action).toBe('checkout');
  });

  test('does NOT add duplicate with same action + payload', async () => {
    const payload = { source: 'geofence' };
    await queueOfflineAttendanceAction('checkout', payload);
    await queueOfflineAttendanceAction('checkout', payload);

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('allows same action with different payloads', async () => {
    await queueOfflineAttendanceAction('checkin', { status: 'present' });
    await queueOfflineAttendanceAction('checkin', { status: 'wfh' });

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    expect(JSON.parse(raw!)).toHaveLength(2);
  });

  test('appends to existing queue without overwriting', async () => {
    await queueOfflineAttendanceAction('checkin', { status: 'present' });
    await queueOfflineAttendanceAction('checkout', { source: 'manual' });

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    expect(JSON.parse(raw!)).toHaveLength(2);
  });

  test('queuedAtMs is set to current timestamp', async () => {
    await queueOfflineAttendanceAction('checkin', {});
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    const queue = JSON.parse(raw!);
    expect(queue[0].queuedAtMs).toBe(Date.now());
  });
});

// ── flushOfflineQueue ─────────────────────────────────────────────────────────

describe('flushOfflineQueue', () => {
  const QUEUE_KEY = 'officeorbit_attendance_queue_v1';

  test('does nothing when queue is empty', async () => {
    await flushOfflineQueue();
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  test('calls check-in API for queued checkin actions', async () => {
    await queueOfflineAttendanceAction('checkin', { status: 'present', source: 'geofence' });
    mockCallApi.mockResolvedValueOnce({ error: null, data: { id: 'attendance-1' } });

    await flushOfflineQueue();
    expect(mockCallApi).toHaveBeenCalledWith('check-in', expect.objectContaining({ status: 'present' }));
  });

  test('calls check-out API for queued checkout actions', async () => {
    await queueOfflineAttendanceAction('checkout', { source: 'geofence' });
    mockCallApi.mockResolvedValueOnce({ error: null, data: {} });

    await flushOfflineQueue();
    expect(mockCallApi).toHaveBeenCalledWith('check-out', expect.objectContaining({ source: 'geofence' }));
  });

  test('keeps item in queue when API returns error (retry later)', async () => {
    await queueOfflineAttendanceAction('checkin', { status: 'present' });
    mockCallApi.mockResolvedValueOnce({ error: 'Server unavailable', data: null });

    await flushOfflineQueue();

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('removes item from queue after successful flush', async () => {
    await queueOfflineAttendanceAction('checkout', { source: 'manual' });
    mockCallApi.mockResolvedValueOnce({ error: null, data: {} });

    await flushOfflineQueue();

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    expect(JSON.parse(raw!)).toHaveLength(0);
  });

  test('discards items older than 24 hours', async () => {
    await queueOfflineAttendanceAction('checkin', { status: 'present' });
    jest.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);

    await flushOfflineQueue();

    expect(mockCallApi).not.toHaveBeenCalled();
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    expect(JSON.parse(raw!)).toHaveLength(0);
  });

  test('partially flushes — keeps failed, removes successful', async () => {
    await queueOfflineAttendanceAction('checkin', { status: 'present', source: 'geofence' });
    await queueOfflineAttendanceAction('checkout', { source: 'manual' });

    mockCallApi
      .mockResolvedValueOnce({ error: 'Network failed', data: null })
      .mockResolvedValueOnce({ error: null, data: {} });

    await flushOfflineQueue();

    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    const remaining = JSON.parse(raw!);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].action).toBe('checkin');
  });
});

// ── clockIn ───────────────────────────────────────────────────────────────────

describe('clockIn', () => {
  const location = { latitude: 12.97, longitude: 77.59, address: 'Test Office' };

  test('returns data on successful check-in', async () => {
    mockCallApi.mockResolvedValueOnce({ data: { id: 'log-1', status: 'present' }, error: null });

    const { data, error } = await clockIn('present', location, 'manual');
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'log-1', status: 'present' });
  });

  test('calls check-in Edge Function with correct payload', async () => {
    mockCallApi.mockResolvedValueOnce({ data: {}, error: null });

    await clockIn('present', location, 'geofence');
    expect(mockCallApi).toHaveBeenCalledWith('check-in', {
      location,
      status: 'present',
      source: 'geofence',
    });
  });

  test('returns error object when API fails', async () => {
    mockCallApi.mockResolvedValueOnce({ data: null, error: 'You are too far from office.' });

    const { data, error } = await clockIn('present', location, 'manual');
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toBe('You are too far from office.');
  });

  test('defaults source to "manual" when not provided', async () => {
    mockCallApi.mockResolvedValueOnce({ data: {}, error: null });
    await clockIn('wfh', location);

    expect(mockCallApi).toHaveBeenCalledWith('check-in', expect.objectContaining({ source: 'manual' }));
  });
});

// ── clockOut ──────────────────────────────────────────────────────────────────

describe('clockOut', () => {
  test('returns data on successful check-out', async () => {
    mockCallApi.mockResolvedValueOnce({ data: { id: 'log-1', total_minutes: 480 }, error: null });

    const { data, error } = await clockOut('manual');
    expect(error).toBeNull();
    expect(data).toMatchObject({ total_minutes: 480 });
  });

  test('calls check-out Edge Function with correct source', async () => {
    mockCallApi.mockResolvedValueOnce({ data: {}, error: null });

    await clockOut('geofence');
    expect(mockCallApi).toHaveBeenCalledWith('check-out', { source: 'geofence' });
  });

  test('returns error when no active check-in found', async () => {
    mockCallApi.mockResolvedValueOnce({ data: null, error: 'No active check-in found for today.' });

    const { data, error } = await clockOut('manual');
    expect(data).toBeNull();
    expect(error?.message).toBe('No active check-in found for today.');
  });

  test('defaults source to "manual"', async () => {
    mockCallApi.mockResolvedValueOnce({ data: {}, error: null });
    await clockOut();
    expect(mockCallApi).toHaveBeenCalledWith('check-out', { source: 'manual' });
  });
});

// ── getTodayAttendance ────────────────────────────────────────────────────────

describe('getTodayAttendance', () => {
  test('returns today log on success', async () => {
    const log = { id: 'log-1', date: '2026-05-10', status: 'present' };
    mockCallApi.mockResolvedValueOnce({ data: log, error: null });

    const { data, error } = await getTodayAttendance();
    expect(error).toBeNull();
    expect(data).toEqual(log);
  });

  test('returns null data when no record exists (API returns null)', async () => {
    mockCallApi.mockResolvedValueOnce({ data: null, error: null });

    const { data, error } = await getTodayAttendance();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  test('returns error when API fails', async () => {
    mockCallApi.mockResolvedValueOnce({ data: null, error: 'Database error' });

    const { data, error } = await getTodayAttendance();
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});

// ── getWeeklyAttendance ───────────────────────────────────────────────────────

describe('getWeeklyAttendance', () => {
  test('returns array of logs on success', async () => {
    const logs = [{ id: 'log-1' }, { id: 'log-2' }];
    mockCallApi.mockResolvedValueOnce({ data: logs, error: null });

    const { data, error } = await getWeeklyAttendance();
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  test('returns empty array when API data is null', async () => {
    mockCallApi.mockResolvedValueOnce({ data: null, error: null });

    const { data } = await getWeeklyAttendance();
    expect(data).toEqual([]);
  });

  test('passes limit parameter to callApi', async () => {
    mockCallApi.mockResolvedValueOnce({ data: [], error: null });
    await getWeeklyAttendance(400);
    expect(mockCallApi).toHaveBeenCalledWith('attendance-history', { limit: 400 });
  });
});

// ── getSessionStatus ──────────────────────────────────────────────────────────

describe('getSessionStatus', () => {
  test('returns session status on success', async () => {
    const status = { daily_record: null, sessions: [], live_duration_minutes: 0, is_inside: false };
    mockCallApi.mockResolvedValueOnce({ data: status, error: null });

    const { data, error } = await getSessionStatus();
    expect(error).toBeNull();
    expect(data).toEqual(status);
  });

  test('returns error when API fails', async () => {
    mockCallApi.mockResolvedValueOnce({ data: null, error: 'Unauthorized' });

    const { data, error } = await getSessionStatus();
    expect(data).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});
