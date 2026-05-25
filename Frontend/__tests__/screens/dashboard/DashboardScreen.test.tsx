import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Dashboard } from '../../../src/screens/dashboard/DashboardScreen';
import { useLocalSearchParams } from 'expo-router';
import { useAttendanceRecovery } from '../../../src/hooks/useAttendanceRecovery';
import { Alert } from 'react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  hasServicesEnabledAsync: jest.fn(() => Promise.resolve(true)),
  getLastKnownPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 12.97, longitude: 77.59 } })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 12.97, longitude: 77.59 } })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../src/store/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: '123' },
    profile: {
      username: 'Test User',
      company_location: { latitude: 12.97, longitude: 77.59, address: 'Test Office' },
    },
    loading: false,
  })),
}));

jest.mock('../../../src/components/common/Toast', () => ({
  useToast: jest.fn(() => ({
    showToast: jest.fn(),
  })),
}));

jest.mock('../../../src/hooks/useAttendance', () => ({
  useAttendance: jest.fn(() => ({
    todayLog: null,
    weeklyLogs: [],
    loading: false,
    refresh: jest.fn(),
    refreshing: false,
    optimisticUpdate: jest.fn(() => jest.fn()),
  })),
}));

jest.mock('../../../src/hooks/useAttendanceRecovery', () => ({
  useAttendanceRecovery: jest.fn(() => ({
    pendingRecovery: null,
    clearRecovery: jest.fn(),
  })),
}));

jest.mock('../../../src/services/AttendanceService', () => ({
  clockIn: jest.fn(),
  clockOut: jest.fn(),
  queueOfflineAttendanceAction: jest.fn(),
}));

jest.mock('../../../src/services/NotificationService', () => ({
  addNotification: jest.fn(),
  sendDeviceNotification: jest.fn(),
  subscribeNotifications: jest.fn(() => jest.fn()),
  getUnreadCount: jest.fn(() => 0),
}));

jest.mock('../../../src/services/AttendanceRecoveryService', () => ({
  isLikelyNetworkError: jest.fn(() => false),
  queueAttendanceRecovery: jest.fn(),
  queueAttendanceRecoveryFromError: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Renders the Dashboard and flushes all async side-effects
 * (SecureStore reads, location checks, streak boot) so they settle
 * before assertions run.
 *
 * Key rule: NEVER wrap RNTL's render() itself in act() — RNTL does that
 * internally and double-wrapping causes "Can't access .root on unmounted
 * test renderer". Instead, call render() normally, then flush with an
 * empty `await act(async () => {})`.
 */
async function renderDashboard() {
  const result = render(<Dashboard />);
  // Drain the microtask queue so async useEffect callbacks (loadWfoStreakState,
  // location distance check) complete and their setState calls are batched.
  await act(async () => {});
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardScreen rendered UI tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  test('1. Dashboard manual check-in failure cases with rendered UI - Network error', async () => {
    const { clockIn } = require('../../../src/services/AttendanceService');
    const { queueOfflineAttendanceAction } = require('../../../src/services/AttendanceService');
    const { queueAttendanceRecovery, isLikelyNetworkError } = require('../../../src/services/AttendanceRecoveryService');

    clockIn.mockResolvedValueOnce({ error: { message: 'Network error' } });
    isLikelyNetworkError.mockReturnValueOnce(true);

    const { getByTestId } = await renderDashboard();

    await act(async () => {
      fireEvent(getByTestId('dashboard-attendance-slide'), 'swipeSuccess');
    });

    await waitFor(() => {
      expect(clockIn).toHaveBeenCalledWith('present', expect.anything(), 'manual');
    });

    await waitFor(() => {
      expect(queueOfflineAttendanceAction).toHaveBeenCalledWith('checkin', expect.anything());
    });

    await waitFor(() => {
      expect(queueAttendanceRecovery).toHaveBeenCalledWith({
        action: 'checkin',
        source: 'manual',
        reason: 'network_error',
        detail: 'Network error',
        queuedOffline: true,
      });
    });
  });

  test('2. Attendance recovery banner interactions', async () => {
    const mockClearRecovery = jest.fn();
    (useAttendanceRecovery as jest.Mock).mockReturnValue({
      pendingRecovery: {
        action: 'checkin',
        source: 'manual',
        reason: 'network_error',
        title: 'Network Offline',
        body: 'Tap to retry check-in.',
        requiresSettings: false,
      },
      clearRecovery: mockClearRecovery,
    });

    const { getByText, getByTestId } = await renderDashboard();

    expect(getByText('Network Offline')).toBeTruthy();
    expect(getByText('Tap to retry check-in.')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('attendance-recovery-dismiss'));
    });

    await waitFor(() => {
      expect(mockClearRecovery).toHaveBeenCalled();
    });
  });

  test('3. Notification tap -> dashboard recovery dialog behavior', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ recovery: '1' });
    (useAttendanceRecovery as jest.Mock).mockReturnValue({
      pendingRecovery: {
        action: 'checkin',
        source: 'manual',
        reason: 'location_permission',
        title: 'Location Permission Needed',
        body: 'Please grant location permission to check in.',
        requiresSettings: true,
      },
      clearRecovery: jest.fn(),
    });

    const { getAllByText } = await renderDashboard();

    expect(getAllByText('Location Permission Needed').length).toBeGreaterThan(0);
    expect(getAllByText('Please grant location permission to check in.').length).toBeGreaterThan(0);
    expect(getAllByText('Open Settings').length).toBeGreaterThan(0);
  });

  test('4. Netflix-style paywall prompt appears after 1.5s delay for new free users', async () => {
    jest.useFakeTimers();
    const SecureStore = require('expo-secure-store');
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'has_seen_initial_paywall_prompt') {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const { getByText, queryByText } = await renderDashboard();

    // Initially, paywall modal should not be visible (delay is 1.5s)
    expect(queryByText('Smart Free')).toBeNull();

    // Advance timers by 1.5s (1500ms)
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Wait for paywall text to appear
    await waitFor(() => {
      expect(getByText('Smart Free')).toBeTruthy();
    });

    // Verify SecureStore setItemAsync was called to persist the flag
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('has_seen_initial_paywall_prompt', 'true');
    jest.useRealTimers();
  });

  test('5. Netflix-style paywall prompt does not appear if user has already seen it', async () => {
    jest.useFakeTimers();
    const SecureStore = require('expo-secure-store');
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === 'has_seen_initial_paywall_prompt') {
        return Promise.resolve('true');
      }
      return Promise.resolve(null);
    });

    const { queryByText } = await renderDashboard();

    // Advance timers by 1.5s (1500ms)
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Paywall modal should not be visible
    expect(queryByText('Smart Free')).toBeNull();

    // Verify SecureStore setItemAsync was NOT called
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('has_seen_initial_paywall_prompt', 'true');
    jest.useRealTimers();
  });
});
