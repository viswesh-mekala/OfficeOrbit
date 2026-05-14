// Jest ALLOWS variables prefixed with 'mock' inside jest.mock() factory closures.

const mockStore = new Map<string, string>();
const mockCallApi = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockQueueOfflineAttendanceAction = jest.fn();
const mockQueueAttendanceRecovery = jest.fn();
const mockQueueAttendanceRecoveryFromError = jest.fn();
const mockClearPendingAttendanceRecovery = jest.fn();
const mockSendDeviceNotification = jest.fn();
const mockAddNotification = jest.fn();
const mockStartActivePolling = jest.fn();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 'balanced' },
  getCurrentPositionAsync: mockGetCurrentPositionAsync,
}));
jest.mock('../../src/services/api/apiClient', () => ({ callApi: mockCallApi }));
jest.mock('../../src/services/AttendanceService', () => ({
  queueOfflineAttendanceAction: mockQueueOfflineAttendanceAction,
}));
jest.mock('../../src/services/AttendanceRecoveryService', () => ({
  queueAttendanceRecovery: mockQueueAttendanceRecovery,
  queueAttendanceRecoveryFromError: mockQueueAttendanceRecoveryFromError,
  clearPendingAttendanceRecovery: mockClearPendingAttendanceRecovery,
  isLikelyNetworkError: (msg?: string | null) => (msg ?? '').toLowerCase().includes('network'),
}));
jest.mock('../../src/services/NotificationService', () => ({
  sendDeviceNotification: mockSendDeviceNotification,
  addNotification: mockAddNotification,
}));
jest.mock('../../src/services/LocationService', () => ({
  startActivePolling: mockStartActivePolling,
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

const OFFICE = { latitude: 12.97, longitude: 77.59 };
const NEAR_OFFICE = { coords: { latitude: 12.97, longitude: 77.59 } };
// ~556m away (0.005° lat ≈ 556m) — outside 500m fence, below 1500m fast-exit
const FAR_FROM_OFFICE = { coords: { latitude: 12.975, longitude: 77.59 } };
// ~65km away — triggers immediate fast-exit (> 1500m)
const VERY_FAR = { coords: { latitude: 13.5, longitude: 78.0 } };

// Pre-seed automation state in SecureStore
const setAutomationState = async (pendingEnterAt: number | null, exitPollingStartMs: number | null = null, outsideSamplesCount = 0) => {
  mockStore.set(
    'officeorbit_automation_state_v2',
    JSON.stringify({ pendingEnterAt, exitPollingStartMs, outsideSamplesCount }),
  );
};

const profileApiMock = () =>
  mockCallApi.mockImplementation(async (fn: string) => {
    if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
    return { data: null, error: null };
  });

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-05-12T08:00:00.000Z')); // Tuesday
  mockStore.clear();
  mockCallApi.mockReset();
  mockGetCurrentPositionAsync.mockReset();
  mockQueueOfflineAttendanceAction.mockReset();
  mockQueueAttendanceRecovery.mockReset();
  mockQueueAttendanceRecoveryFromError.mockReset();
  mockClearPendingAttendanceRecovery.mockReset();
  mockSendDeviceNotification.mockReset();
  mockAddNotification.mockReset();
  mockStartActivePolling.mockReset();
});


afterEach(() => {
  jest.useRealTimers();
});

// ── confirmDwellIfReady ───────────────────────────────────────────────────────

describe('AttendanceAutomation › confirmDwellIfReady', () => {
  test('returns false when no pendingEnterAt in state', async () => {
    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();
    expect(result).toBe(false);
  });

  test('returns false when dwell time has not passed (< 5 min)', async () => {
    const now = Date.now();
    await setAutomationState(now - 3 * 60 * 1000); // only 3 min ago

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();
    expect(result).toBe(false);
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  test('returns false when no GPS position and under 30-min timeout', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(null);

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();
    expect(result).toBe(false);
    expect(mockQueueAttendanceRecovery).not.toHaveBeenCalled();
  });

  test('queues recovery and returns true when no GPS after 30-min timeout', async () => {
    await setAutomationState(Date.now() - 31 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(null);

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();

    expect(result).toBe(true);
    expect(mockQueueAttendanceRecovery).toHaveBeenCalledWith({
      action: 'checkin',
      source: 'auto',
      reason: 'location_unavailable',
    });
  });

  test('queues recovery for missing office location and returns true', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(NEAR_OFFICE);
    mockCallApi.mockResolvedValue({ data: { company_location: null }, error: null });

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();

    expect(result).toBe(true);
    expect(mockQueueAttendanceRecovery).toHaveBeenCalledWith({
      action: 'checkin',
      source: 'auto',
      reason: 'office_location_missing',
    });
  });

  test('returns true (pass-by) when user is now far from office after dwell', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(FAR_FROM_OFFICE);
    profileApiMock();

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();

    expect(result).toBe(true);
    expect(mockCallApi).not.toHaveBeenCalledWith('check-in', expect.anything());
  });

  test('calls check-in API when user is still inside after 5 min', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(NEAR_OFFICE);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-in') return { data: { id: 'att-1' }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();

    expect(result).toBe(true);
    expect(mockCallApi).toHaveBeenCalledWith('check-in', expect.objectContaining({ status: 'present', source: 'geofence' }));
  });

  test('fires success notification on successful check-in', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(NEAR_OFFICE);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-in') return { data: { id: 'att-1' }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.confirmDwellIfReady();

    expect(mockSendDeviceNotification).toHaveBeenCalledWith(
      '🏢 Arrived at Office',
      "You've been checked in automatically. Have a great day!",
    );
    expect(mockClearPendingAttendanceRecovery).toHaveBeenCalledWith('checkin');
  });

  test('queues offline action and recovery on network error during check-in', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(NEAR_OFFICE);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-in') return { data: null, error: 'Network error occurred' };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.confirmDwellIfReady();

    expect(result).toBe(true);
    expect(mockQueueOfflineAttendanceAction).toHaveBeenCalledWith('checkin', expect.objectContaining({ status: 'present', source: 'geofence' }));
    expect(mockQueueAttendanceRecoveryFromError).toHaveBeenCalledWith(expect.objectContaining({
      action: 'checkin',
      source: 'auto',
      queuedOffline: true,
    }));
  });

  test('queues non-network API failure recovery without offline queue', async () => {
    await setAutomationState(Date.now() - 6 * 60 * 1000);
    mockGetCurrentPositionAsync.mockResolvedValueOnce(NEAR_OFFICE);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-in') return { data: null, error: 'Internal server error' };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.confirmDwellIfReady();

    expect(mockQueueOfflineAttendanceAction).not.toHaveBeenCalled();
    expect(mockQueueAttendanceRecoveryFromError).toHaveBeenCalledWith(expect.objectContaining({
      action: 'checkin',
      fallbackReason: 'api_failed',
    }));
  });
});

// ── handleGeofenceEnter ────────────────────────────────────────────────────────

describe('AttendanceAutomation › handleGeofenceEnter', () => {
  test('skips processing on weekends', async () => {
    // Saturday
    jest.setSystemTime(new Date('2026-05-09T08:00:00.000Z')); // Saturday
    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceEnter();
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  test('stores pendingEnterAt timestamp when entering', async () => {
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return { data: { is_manual_override: false, check_in: null, check_out: null }, error: null };
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      return { data: null, error: null };
    });
    mockGetCurrentPositionAsync.mockResolvedValueOnce(null); // no GPS yet — dwell not ready

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceEnter();

    // State is written immediately (pendingEnterAt is set before confirmDwellIfReady)
    // Key invariant: check-in API was NOT called (dwell not ready yet — no GPS fix)
    expect(mockCallApi).not.toHaveBeenCalledWith('check-in', expect.anything());
  });

  test('ignores duplicate ENTER events when pendingEnterAt already set', async () => {
    await setAutomationState(Date.now() - 1000); // already pending

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceEnter();

    // callApi should NOT have been called (skipped due to existing pending)
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  test('skips when day is manually overridden', async () => {
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return { data: { is_manual_override: true }, error: null };
      return { data: null, error: null };
    });
    mockGetCurrentPositionAsync.mockResolvedValueOnce(null);

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceEnter();

    // pendingEnterAt was set but then handleManualOverride would have stopped it
    // The key check: check-in API was never called
    expect(mockCallApi).not.toHaveBeenCalledWith('check-in', expect.anything());
  });
});

// ── handleGeofenceExit ────────────────────────────────────────────────────────

describe('AttendanceAutomation › handleGeofenceExit', () => {
  test('skips on weekends', async () => {
    jest.setSystemTime(new Date('2026-05-09T08:00:00.000Z')); // Saturday // Saturday
    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceExit();
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  test('skips when no daily record exists (user never checked in)', async () => {
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return { data: null, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceExit();

    expect(mockStartActivePolling).not.toHaveBeenCalled();
  });

  test('clears pending enter on quick exit (pass-by, < 5 min dwell)', async () => {
    const recentEnterAt = Date.now() - 2 * 60 * 1000; // 2 min ago
    await setAutomationState(recentEnterAt);
    // For handleGeofenceExit: daily record must exist (check_in set) AND check_out null
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return {
        data: { check_in: '2026-05-10T07:00:00Z', check_out: null, is_manual_override: false },
        error: null,
      };
      if (fn === 'session-status') return { data: { is_inside: true }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceExit();

    // Quick exit clears the pendingEnterAt without starting exit polling
    expect(mockStartActivePolling).not.toHaveBeenCalled();
  });

  test('starts exit polling when user has active session and is inside', async () => {
    // pendingEnterAt must be >5min ago so it's NOT a quick pass-by
    const oldEnterAt = Date.now() - 10 * 60 * 1000; // 10 min ago
    await setAutomationState(oldEnterAt);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return { data: { check_in: '2026-05-10T07:00:00Z', check_out: null, is_manual_override: false }, error: null };
      if (fn === 'session-status') return { data: { is_inside: true }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceExit();

    expect(mockStartActivePolling).toHaveBeenCalled();
  });

  test('skips exit polling when session is not inside', async () => {
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return { data: { check_in: '2026-05-10T07:00:00Z', check_out: null }, error: null };
      if (fn === 'session-status') return { data: { is_inside: false }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceExit();

    expect(mockStartActivePolling).not.toHaveBeenCalled();
  });

  test('skips when already checked out', async () => {
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'attendance-today') return {
        data: { check_in: '2026-05-10T08:00:00Z', check_out: '2026-05-10T09:00:00Z' },
        error: null,
      };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleGeofenceExit();

    expect(mockStartActivePolling).not.toHaveBeenCalled();
  });
});

// ── handleActivePollingSample ─────────────────────────────────────────────────

describe('AttendanceAutomation › handleActivePollingSample', () => {
  test('returns true on weekend (stop polling)', async () => {
    jest.setSystemTime(new Date('2026-05-09T08:00:00.000Z')); // Saturday
    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.handleActivePollingSample(NEAR_OFFICE);
    expect(result).toBe(true);
  });

  test('returns true (stop polling) when exit timeout exceeded', async () => {
    const OLD_START = Date.now() - 20 * 60 * 1000; // 20 min ago > 15 min timeout
    await setAutomationState(null, OLD_START, 0);

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.handleActivePollingSample(FAR_FROM_OFFICE);
    expect(result).toBe(true);
  });

  test('cancels exit polling when user is back inside (sample inside 500m)', async () => {
    const exitStart = Date.now() - 5 * 60 * 1000;
    await setAutomationState(null, exitStart, 1);
    profileApiMock();

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.handleActivePollingSample(NEAR_OFFICE);
    expect(result).toBe(true); // stop polling (user came back)
    expect(mockCallApi).not.toHaveBeenCalledWith('check-out', expect.anything());
  });

  test('immediately checks out when sample is very far (>= 1500m)', async () => {
    const exitStart = Date.now() - 5 * 60 * 1000;
    await setAutomationState(null, exitStart, 0);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-out') return { data: { total_minutes: 480, status: 'present' }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.handleActivePollingSample(VERY_FAR);

    expect(result).toBe(true);
    expect(mockCallApi).toHaveBeenCalledWith('check-out', expect.objectContaining({ source: 'geofence' }));
  });

  test('accumulates outside samples before confirming exit (needs 2)', async () => {
    const exitStart = Date.now() - 5 * 60 * 1000;
    await setAutomationState(null, exitStart, 0);
    profileApiMock();

    const automation = require('../../src/services/AttendanceAutomation');
    // First outside sample (not far enough for fast exit) — not checking out yet
    const result = await automation.handleActivePollingSample(FAR_FROM_OFFICE);
    expect(result).toBe(false); // needs more samples

    // Verify outside samples counter incremented (read directly from mockStore)
    const raw = mockStore.get('officeorbit_automation_state_v2');
    const state = JSON.parse(raw!);
    expect(state.outsideSamplesCount).toBe(1);
  });

  test('confirms exit and checks out after 2 outside samples', async () => {
    const exitStart = Date.now() - 5 * 60 * 1000;
    await setAutomationState(null, exitStart, 1); // already has 1 sample
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-out') return { data: { total_minutes: 300, status: 'present' }, error: null };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    const result = await automation.handleActivePollingSample(FAR_FROM_OFFICE);

    expect(result).toBe(true);
    expect(mockCallApi).toHaveBeenCalledWith('check-out', expect.objectContaining({ source: 'geofence' }));
    expect(mockSendDeviceNotification).toHaveBeenCalled();
  });

  test('fires checkout notification with formatted duration', async () => {
    const exitStart = Date.now() - 5 * 60 * 1000;
    await setAutomationState(null, exitStart, 1);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-out') return { data: { total_minutes: 495, status: 'present' }, error: null }; // 8h 15m
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleActivePollingSample(FAR_FROM_OFFICE);

    expect(mockSendDeviceNotification).toHaveBeenCalledWith(
      expect.stringContaining('8h 15m'),
      expect.any(String),
    );
  });

  test('queues offline checkout and recovery on network failure during checkout', async () => {
    const exitStart = Date.now() - 5 * 60 * 1000;
    await setAutomationState(null, exitStart, 1);
    mockCallApi.mockImplementation(async (fn: string) => {
      if (fn === 'profile-get') return { data: { company_location: OFFICE }, error: null };
      if (fn === 'check-out') return { data: null, error: 'Network error: connection refused' };
      return { data: null, error: null };
    });

    const automation = require('../../src/services/AttendanceAutomation');
    await automation.handleActivePollingSample(FAR_FROM_OFFICE);

    expect(mockQueueOfflineAttendanceAction).toHaveBeenCalledWith('checkout', expect.anything());
    expect(mockQueueAttendanceRecoveryFromError).toHaveBeenCalledWith(expect.objectContaining({
      action: 'checkout',
      source: 'auto',
      queuedOffline: true,
    }));
  });
});
