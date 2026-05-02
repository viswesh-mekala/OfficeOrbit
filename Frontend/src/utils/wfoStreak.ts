import * as SecureStore from 'expo-secure-store';
import type { AttendanceLog } from '../services/AttendanceService';

export type StreakPeriodType = 'week' | 'month';

export interface WfoStreakState {
  streakCount: number;
  lastProcessedPeriodKey: string | null;
}

export interface WfoStreakEvaluation {
  streakCount: number;
  lastProcessedPeriodKey: string | null;
  /** Most recent fully completed period in chronological scan order */
  lastClosedPeriodKey: string | null;
  lastClosedOk: boolean | null;
  lastClosedOfficeDays: number | null;
  requiredOfficeDays: number | null;
  periodType: StreakPeriodType;
  /** ISO date (YYYY-MM-DD) of Mon for weekly / first day for monthly bucket */
  currentPeriodKey: string;
  currentPeriodOfficeDays: number;
}

const STORAGE_PREFIX = 'officeorbit_wfo_streak_v1';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Parse `YYYY-MM-DD` as local calendar date (avoid UTC shifts). */
export const parseLocalDate = (dateStr: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export const formatLocalYmd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const startOfIsoWeekMonday = (d: Date): Date => {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const monthKeyFromDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

export const weekPeriodKeyFromDate = (d: Date) =>
  formatLocalYmd(startOfIsoWeekMonday(d));

/** Count Mon–Fri days inclusive in [start,end] local dates. */
export const countWeekdaysInclusive = (start: Date, end: Date): number => {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (e < s) return 0;
  let count = 0;
  for (
    let cur = new Date(s);
    cur <= e;
    cur.setDate(cur.getDate() + 1)
  ) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

const storageKeyForUser = async () => {
  const raw = await SecureStore.getItemAsync('officeorbit_active_user_id');
  return raw ? `${STORAGE_PREFIX}_${raw}` : STORAGE_PREFIX;
};

export const setActiveUserIdForStreakStorage = async (userId: string | null) => {
  if (!userId) {
    await SecureStore.deleteItemAsync('officeorbit_active_user_id');
    return;
  }
  await SecureStore.setItemAsync('officeorbit_active_user_id', userId);
};

export const loadWfoStreakState = async (): Promise<WfoStreakState> => {
  const key = await storageKeyForUser();
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return { streakCount: 0, lastProcessedPeriodKey: null };
  try {
    const parsed = JSON.parse(raw) as Partial<WfoStreakState>;
    return {
      streakCount: typeof parsed.streakCount === 'number' ? parsed.streakCount : 0,
      lastProcessedPeriodKey:
        typeof parsed.lastProcessedPeriodKey === 'string'
          ? parsed.lastProcessedPeriodKey
          : null,
    };
  } catch {
    return { streakCount: 0, lastProcessedPeriodKey: null };
  }
};

export const saveWfoStreakState = async (state: WfoStreakState) => {
  const key = await storageKeyForUser();
  await SecureStore.setItemAsync(key, JSON.stringify(state));
};

export interface EvaluateWfoStreakArgs {
  logs: AttendanceLog[];
  periodType: StreakPeriodType;
  rawTargetDays: number;
  today?: Date;
}

/**
 * Computes how many consecutive past periods satisfied the office-day minimum.
 * The current (open) period is excluded from streak increments until it closes,
 * but `currentPeriodOfficeDays` reflects progress so far.
 */
export const evaluateWfoStreak = ({
  logs,
  periodType,
  rawTargetDays,
  today = new Date(),
}: EvaluateWfoStreakArgs): WfoStreakEvaluation => {
  const todayLocal = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const presentDates = new Set(
    logs
      .filter((l) => l.status === 'present')
      .map((l) => l.date)
      .filter(Boolean),
  );

  const earliestDateStr = logs
    .map((l) => l.date)
    .filter(Boolean)
    .sort()[0];

  let scanStart = earliestDateStr
    ? parseLocalDate(earliestDateStr)
    : new Date(todayLocal);
  if (!scanStart) scanStart = new Date(todayLocal);

  // Include a little padding before earliest log so first bucket boundary is stable
  scanStart = new Date(
    scanStart.getFullYear(),
    scanStart.getMonth(),
    scanStart.getDate() - 14,
  );

  let streakCount = 0;
  let lastProcessed: string | null = null;

  let lastClosedKey: string | null = null;
  let lastClosedOk: boolean | null = null;
  let lastClosedOfficeDays: number | null = null;

  const requiredOfficeDays =
    rawTargetDays > 0 ? Math.max(1, Math.round(rawTargetDays)) : null;

  const currentPeriodKey =
    periodType === 'month'
      ? `${todayLocal.getFullYear()}-${pad2(todayLocal.getMonth() + 1)}`
      : weekPeriodKeyFromDate(todayLocal);

  const countOfficeInWeek = (weekMondayYmd: string) => {
    const mon = parseLocalDate(weekMondayYmd);
    if (!mon) return 0;
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    let c = 0;
    for (
      let cur = new Date(mon);
      cur <= sun;
      cur.setDate(cur.getDate() + 1)
    ) {
      const dow = cur.getDay();
      if (dow === 0 || dow === 6) continue;
      const ymd = formatLocalYmd(cur);
      if (presentDates.has(ymd)) c++;
    }
    return c;
  };

  const countOfficeInMonth = (monthKey: string) => {
    const [ys, ms] = monthKey.split('-');
    const y = Number(ys);
    const m = Number(ms) - 1;
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
    const lastDay = new Date(y, m + 1, 0).getDate();
    let c = 0;
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(y, m, d);
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) continue;
      const ymd = formatLocalYmd(dt);
      if (presentDates.has(ymd)) c++;
    }
    return c;
  };

  const isClosedPeriod = (periodKey: string) => {
    if (periodType === 'month') {
      const [ys, ms] = periodKey.split('-');
      const y = Number(ys);
      const m = Number(ms) - 1;
      const end = new Date(y, m + 1, 0);
      return end < todayLocal;
    }
    const mon = parseLocalDate(periodKey);
    if (!mon) return false;
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    return sun < todayLocal;
  };

  const enumerateWeekKeysAscending = (): string[] => {
    const keys: string[] = [];
    let cursor = startOfIsoWeekMonday(scanStart);
    const endWeekStart = startOfIsoWeekMonday(todayLocal);
    while (cursor <= endWeekStart) {
      keys.push(formatLocalYmd(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    }
    return keys;
  };

  const enumerateMonthKeysAscending = (): string[] => {
    const keys: string[] = [];
    let cursor = new Date(scanStart.getFullYear(), scanStart.getMonth(), 1);
    const end = new Date(todayLocal.getFullYear(), todayLocal.getMonth(), 1);
    while (cursor <= end) {
      keys.push(`${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return keys;
  };

  const keys =
    periodType === 'month' ? enumerateMonthKeysAscending() : enumerateWeekKeysAscending();

  if (!requiredOfficeDays) {
    const currentOffice =
      periodType === 'month'
        ? countOfficeInMonth(currentPeriodKey)
        : countOfficeInWeek(currentPeriodKey);
    return {
      streakCount: 0,
      lastProcessedPeriodKey: null,
      lastClosedPeriodKey: null,
      lastClosedOk: null,
      lastClosedOfficeDays: null,
      requiredOfficeDays: null,
      periodType,
      currentPeriodKey,
      currentPeriodOfficeDays: currentOffice,
    };
  }

  for (const key of keys) {
    const closed = isClosedPeriod(key);
    const officeDays =
      periodType === 'month' ? countOfficeInMonth(key) : countOfficeInWeek(key);

    if (!closed) {
      // Open period — handled after loop via current counters
      continue;
    }

    lastClosedKey = key;
    lastClosedOfficeDays = officeDays;

    let bucketWeekdays = 0;
    if (periodType === 'month') {
      const [ys, ms] = key.split('-');
      const y = Number(ys);
      const m = Number(ms) - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      bucketWeekdays = countWeekdaysInclusive(start, end);
    } else {
      const mon = parseLocalDate(key);
      if (mon) {
        const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
        bucketWeekdays = countWeekdaysInclusive(mon, sun);
      }
    }

    const required = Math.min(requiredOfficeDays, Math.max(1, bucketWeekdays));
    const ok = officeDays >= required;
    lastClosedOk = ok;

    if (!ok) {
      streakCount = 0;
    } else {
      streakCount += 1;
    }
    lastProcessed = key;
  }

  const currentPeriodOfficeDays =
    periodType === 'month'
      ? countOfficeInMonth(currentPeriodKey)
      : countOfficeInWeek(currentPeriodKey);

  return {
    streakCount,
    lastProcessedPeriodKey: lastProcessed,
    lastClosedPeriodKey: lastClosedKey,
    lastClosedOk,
    lastClosedOfficeDays,
    requiredOfficeDays,
    periodType,
    currentPeriodKey,
    currentPeriodOfficeDays,
  };
};
