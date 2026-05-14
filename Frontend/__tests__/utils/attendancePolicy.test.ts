import {
  isCalendarManagedDay,
  liveDurationMinutes,
} from '../../src/utils/attendancePolicy';
import type { AttendanceLog } from '../../src/services/AttendanceService';

const makeLog = (overrides: Partial<AttendanceLog> = {}): AttendanceLog => ({
  id: 'log-1',
  user_id: 'user-1',
  date: '2026-05-10',
  check_in: null,
  check_out: null,
  status: 'present',
  location_check_in: null,
  duration_minutes: 0,
  ...overrides,
});

describe('isCalendarManagedDay', () => {
  test('returns false for null log', () => {
    expect(isCalendarManagedDay(null)).toBe(false);
  });

  test('returns false for undefined log', () => {
    expect(isCalendarManagedDay(undefined)).toBe(false);
  });

  test('returns false when log has check_in', () => {
    expect(isCalendarManagedDay(makeLog({ check_in: '2026-05-10T09:00:00Z' }))).toBe(false);
  });

  test('returns false when log has check_out only', () => {
    // technically invalid state but shouldn't crash
    expect(isCalendarManagedDay(makeLog({ check_out: '2026-05-10T17:00:00Z' }))).toBe(false);
  });

  test('returns false for absent status even with no check_in/out', () => {
    expect(isCalendarManagedDay(makeLog({ status: 'absent', check_in: null, check_out: null }))).toBe(false);
  });

  test('returns true for present status with no check_in or check_out', () => {
    expect(isCalendarManagedDay(makeLog({ status: 'present', check_in: null, check_out: null }))).toBe(true);
  });

  test('returns true for leave status with no timestamps', () => {
    expect(isCalendarManagedDay(makeLog({ status: 'leave', check_in: null, check_out: null }))).toBe(true);
  });

  test('returns true for holiday status with no timestamps', () => {
    expect(isCalendarManagedDay(makeLog({ status: 'holiday', check_in: null, check_out: null }))).toBe(true);
  });

  test('returns true for wfh status with no timestamps', () => {
    expect(isCalendarManagedDay(makeLog({ status: 'wfh', check_in: null, check_out: null }))).toBe(true);
  });
});

describe('liveDurationMinutes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Fix current time to 2026-05-10T10:00:00Z
    jest.setSystemTime(new Date('2026-05-10T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns null for null log', () => {
    expect(liveDurationMinutes(null)).toBeNull();
  });

  test('returns null for log with no check_in', () => {
    expect(liveDurationMinutes(makeLog({ check_in: null }))).toBeNull();
  });

  test('returns duration_minutes when check_out exists', () => {
    const log = makeLog({ check_in: '2026-05-10T09:00:00Z', check_out: '2026-05-10T10:00:00Z', duration_minutes: 60 });
    expect(liveDurationMinutes(log)).toBe(60);
  });

  test('returns null for duration_minutes when check_out exists but duration is null/0', () => {
    const log = makeLog({ check_in: '2026-05-10T09:00:00Z', check_out: '2026-05-10T10:00:00Z', duration_minutes: 0 });
    // when check_out present, returns log.duration_minutes ?? null = 0 (which is falsy but not null)
    // per source: if (log.check_out) return log.duration_minutes ?? null
    expect(liveDurationMinutes(log)).toBe(0);
  });

  test('computes live duration for open shift (check_in at 9am, now is 10am = 60min)', () => {
    const log = makeLog({ check_in: '2026-05-10T09:00:00.000Z', check_out: null });
    // now = 10:00:00, check_in = 09:00:00 → 60 min
    expect(liveDurationMinutes(log)).toBe(60);
  });

  test('returns 0 for live shift that just started (same time)', () => {
    const log = makeLog({ check_in: '2026-05-10T10:00:00.000Z', check_out: null });
    expect(liveDurationMinutes(log)).toBe(0);
  });

  test('returns null for invalid check_in date string', () => {
    const log = makeLog({ check_in: 'not-a-date', check_out: null });
    expect(liveDurationMinutes(log)).toBeNull();
  });
});
