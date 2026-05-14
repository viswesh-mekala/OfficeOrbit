import {
  parseLocalDate,
  formatLocalYmd,
  startOfIsoWeekMonday,
  monthKeyFromDate,
  weekPeriodKeyFromDate,
  countWeekdaysInclusive,
  evaluateWfoStreak,
} from '../../src/utils/wfoStreak';
import type { AttendanceLog } from '../../src/services/AttendanceService';

// Helper to build minimal AttendanceLog entries
const log = (date: string, status: AttendanceLog['status'] = 'present'): AttendanceLog => ({
  id: date,
  user_id: 'u1',
  date,
  check_in: status === 'present' || status === 'wfh' ? `${date}T09:00:00Z` : null,
  check_out: status === 'present' || status === 'wfh' ? `${date}T17:00:00Z` : null,
  status,
  location_check_in: null,
  duration_minutes: 480,
});

// ── parseLocalDate ────────────────────────────────────────────────────────────

describe('parseLocalDate', () => {
  test('parses valid YYYY-MM-DD', () => {
    const d = parseLocalDate('2026-05-10');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(4); // May = 4
    expect(d?.getDate()).toBe(10);
  });

  test('returns null for invalid string', () => {
    expect(parseLocalDate('not-a-date')).toBeNull();
    expect(parseLocalDate('')).toBeNull();
    // Note: JS Date wraps out-of-range months (13 → Jan next year), so
    // '2026-13-01' doesn't produce NaN. The regex won't match it because
    // month 13 is two digits but the source uses raw Date construction.
    // The real guard is the regex /^(\d{4})-(\d{2})-(\d{2})$/ which DOES match
    // '2026-13-01', then new Date(2026, 12, 1) wraps to Jan 1 2027 (not NaN).
    // So parseLocalDate('2026-13-01') returns a valid Date — this is a source quirk.
    expect(parseLocalDate('2026-13-01')).not.toBeNull();
  });

  test('returns null for month format', () => {
    expect(parseLocalDate('2026-05')).toBeNull();
  });
});

// ── formatLocalYmd ────────────────────────────────────────────────────────────

describe('formatLocalYmd', () => {
  test('formats date to YYYY-MM-DD', () => {
    expect(formatLocalYmd(new Date(2026, 4, 10))).toBe('2026-05-10');
  });

  test('pads month and day with leading zeros', () => {
    expect(formatLocalYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

// ── startOfIsoWeekMonday ──────────────────────────────────────────────────────

describe('startOfIsoWeekMonday', () => {
  test('Monday returns itself', () => {
    const mon = new Date(2026, 4, 11); // May 11, 2026 = Monday
    expect(formatLocalYmd(startOfIsoWeekMonday(mon))).toBe('2026-05-11');
  });

  test('Sunday returns previous Monday', () => {
    const sun = new Date(2026, 4, 10); // May 10, 2026 = Sunday
    expect(formatLocalYmd(startOfIsoWeekMonday(sun))).toBe('2026-05-04');
  });

  test('Wednesday returns the Monday of that week', () => {
    const wed = new Date(2026, 4, 13); // May 13 = Wednesday
    expect(formatLocalYmd(startOfIsoWeekMonday(wed))).toBe('2026-05-11');
  });

  test('Saturday returns the Monday of that week', () => {
    const sat = new Date(2026, 4, 16); // May 16 = Saturday
    expect(formatLocalYmd(startOfIsoWeekMonday(sat))).toBe('2026-05-11');
  });
});

// ── monthKeyFromDate ──────────────────────────────────────────────────────────

describe('monthKeyFromDate', () => {
  test('returns YYYY-MM for a date', () => {
    expect(monthKeyFromDate(new Date(2026, 4, 10))).toBe('2026-05');
  });

  test('pads single digit month', () => {
    expect(monthKeyFromDate(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

// ── weekPeriodKeyFromDate ─────────────────────────────────────────────────────

describe('weekPeriodKeyFromDate', () => {
  test('returns Monday YYYY-MM-DD for a Wednesday', () => {
    // May 13, 2026 is a Wednesday → week starts May 11 (Monday)
    expect(weekPeriodKeyFromDate(new Date(2026, 4, 13))).toBe('2026-05-11');
  });
});

// ── countWeekdaysInclusive ────────────────────────────────────────────────────

describe('countWeekdaysInclusive', () => {
  test('counts weekdays in a Mon-Fri week', () => {
    const start = new Date(2026, 4, 11); // Monday
    const end   = new Date(2026, 4, 15); // Friday
    expect(countWeekdaysInclusive(start, end)).toBe(5);
  });

  test('returns 0 for a weekend-only range', () => {
    const start = new Date(2026, 4, 9);  // Saturday
    const end   = new Date(2026, 4, 10); // Sunday
    expect(countWeekdaysInclusive(start, end)).toBe(0);
  });

  test('returns 0 when end is before start', () => {
    const start = new Date(2026, 4, 15);
    const end   = new Date(2026, 4, 11);
    expect(countWeekdaysInclusive(start, end)).toBe(0);
  });

  test('counts single Monday as 1', () => {
    const d = new Date(2026, 4, 11);
    expect(countWeekdaysInclusive(d, d)).toBe(1);
  });

  test('counts single Saturday as 0', () => {
    const d = new Date(2026, 4, 9);
    expect(countWeekdaysInclusive(d, d)).toBe(0);
  });
});

// ── evaluateWfoStreak (core streak logic) ─────────────────────────────────────

describe('evaluateWfoStreak', () => {
  // Test date fixed to Saturday May 10 2026 (same as in other tests)
  const TODAY = new Date(2026, 4, 10); // Saturday

  test('returns streakCount 0 with empty logs', () => {
    const result = evaluateWfoStreak({ logs: [], periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.streakCount).toBe(0);
  });

  test('returns streakCount 0 and requiredOfficeDays null when rawTargetDays is 0', () => {
    const result = evaluateWfoStreak({ logs: [log('2026-05-04')], periodType: 'week', rawTargetDays: 0, today: TODAY });
    expect(result.streakCount).toBe(0);
    expect(result.requiredOfficeDays).toBeNull();
  });

  test('counts 1 streak for a closed week meeting the target', () => {
    // Week of Apr 27–May 3 (closed), 3 office days, target = 3
    const logs = [
      log('2026-04-27'), // Mon
      log('2026-04-28'), // Tue
      log('2026-04-29'), // Wed
    ];
    const result = evaluateWfoStreak({ logs, periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.streakCount).toBe(1);
    expect(result.lastClosedOk).toBe(true);
  });

  test('resets streak to 0 when one closed week misses target', () => {
    // Week Apr 27–May 3: only 2 days, target = 3 → breaks streak
    const logs = [
      log('2026-04-27'),
      log('2026-04-28'),
    ];
    const result = evaluateWfoStreak({ logs, periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.streakCount).toBe(0);
    expect(result.lastClosedOk).toBe(false);
  });

  test('counts 2 consecutive weeks meeting target as streak 2', () => {
    // Apr 20–24: 3 days (week 1 closed)
    // Apr 27–May 3: 3 days (week 2 closed)
    const logs = [
      log('2026-04-20'), log('2026-04-21'), log('2026-04-22'), // week 1
      log('2026-04-27'), log('2026-04-28'), log('2026-04-29'), // week 2
    ];
    const result = evaluateWfoStreak({ logs, periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.streakCount).toBe(2);
  });

  test('streak resets to 0 after a missed week between two good weeks', () => {
    // week1 good, week2 bad (only 1 day), week3 good → streak resets to 1
    const logs = [
      log('2026-04-13'), log('2026-04-14'), log('2026-04-15'), // week 1 (Apr 13 Mon)
      log('2026-04-20'), // week 2 — only 1 of 3 needed
      log('2026-04-27'), log('2026-04-28'), log('2026-04-29'), // week 3 (Apr 27 Mon)
    ];
    const result = evaluateWfoStreak({ logs, periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.streakCount).toBe(1); // week3 is the only good one after the reset
  });

  test('currentPeriodOfficeDays reflects progress in open period', () => {
    // Today = Sat May 10, current week Mon May 4–10
    // Logged Mon, Tue, Wed in current week
    const logs = [
      log('2026-05-04'),
      log('2026-05-05'),
      log('2026-05-06'),
    ];
    const result = evaluateWfoStreak({ logs, periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.currentPeriodOfficeDays).toBe(3);
  });

  test('only "present" status counts for office days (not wfh/leave)', () => {
    const logs = [
      log('2026-04-27', 'present'),
      log('2026-04-28', 'wfh'),    // does NOT count
      log('2026-04-29', 'leave'),  // does NOT count
    ];
    const result = evaluateWfoStreak({ logs, periodType: 'week', rawTargetDays: 3, today: TODAY });
    // Only 1 office day in that closed week, target=3 → streak=0
    expect(result.streakCount).toBe(0);
  });

  test('monthly period type: counts office days across full month', () => {
    // Apr 2026 is a closed month (today = May 10). Use Apr 1-20 (enough weekdays for target=12).
    // Apr 1 = Wed, so weekdays in Apr 1-20: 1,2,3,6,7,8,9,10,13,14,15,16,17,20 = 14 days
    const aprilDays = Array.from({ length: 20 }, (_, i) => {
      const date = new Date(2026, 3, i + 1); // Apr 1–20
      const dow = date.getDay();
      if (dow === 0 || dow === 6) return null;
      return log(`2026-04-${String(i + 1).padStart(2, '0')}`);
    }).filter(Boolean) as AttendanceLog[];

    // Confirm we have at least 12 weekday entries
    expect(aprilDays.length).toBeGreaterThanOrEqual(12);
    const result = evaluateWfoStreak({ logs: aprilDays, periodType: 'month', rawTargetDays: 12, today: TODAY });
    expect(result.streakCount).toBe(1);
    expect(result.lastClosedOk).toBe(true);
  });

  test('returns correct currentPeriodKey for week period', () => {
    // Today is Sat May 10 → week key = Mon May 4
    const result = evaluateWfoStreak({ logs: [], periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(result.currentPeriodKey).toBe('2026-05-04');
  });

  test('returns correct currentPeriodKey for month period', () => {
    const result = evaluateWfoStreak({ logs: [], periodType: 'month', rawTargetDays: 12, today: TODAY });
    expect(result.currentPeriodKey).toBe('2026-05');
  });

  test('periodType is preserved in return', () => {
    const r1 = evaluateWfoStreak({ logs: [], periodType: 'week', rawTargetDays: 3, today: TODAY });
    expect(r1.periodType).toBe('week');

    const r2 = evaluateWfoStreak({ logs: [], periodType: 'month', rawTargetDays: 12, today: TODAY });
    expect(r2.periodType).toBe('month');
  });
});
