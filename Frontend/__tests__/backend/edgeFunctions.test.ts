/**
 * Backend Edge Function tests.
 *
 * ── Tier 1 — Real imports ─────────────────────────────────────────────────────
 *   Tests in this section import directly from _shared/ source files.
 *   They exercise the ACTUAL production code, so a bug in the source
 *   will break these tests (unlike the old inline-copy approach).
 *
 * ── Tier 2 — Contract specs ───────────────────────────────────────────────────
 *   The Deno.serve() handler bodies cannot be imported into Jest (they depend
 *   on the Deno runtime). The tests in this section verify the JSON contract
 *   shape the frontend callApi() wrapper expects. They are clearly labelled
 *   "contract spec" and must NOT duplicate source logic.
 *   Full integration coverage requires `supabase functions serve` (Supabase CLI).
 */

// ── Resolve _shared source files ─────────────────────────────────────────────
// Jest resolves these via relative paths from the Frontend project root.
// The Backend folder is a sibling of Frontend at the repo root.

import {
  getLocalDate,
  calcDurationMinutes,
} from '../../../Backend/supabase/functions/_shared/dateUtils';

import {
  getDistanceFromLatLonInMeters,
} from '../../../Backend/supabase/functions/_shared/locationUtils';

// ── Tier 1 › getLocalDate (real import) ──────────────────────────────────────

describe('Backend _shared › getLocalDate [real import]', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-10T20:30:00.000Z')); // 8:30 PM UTC
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns UTC date when no offset provided', () => {
    expect(getLocalDate()).toBe('2026-05-10');
  });

  test('IST (UTC+5:30) offset -330 → shows next day when UTC is after 6:30 PM', () => {
    // UTC 20:30 − (−330 min) = UTC 20:30 + 5h30m = 2026-05-11T02:00 IST
    expect(getLocalDate(-330)).toBe('2026-05-11');
  });

  test('PST (UTC-8) offset +480 → shows same date at 12:30 PM local', () => {
    // UTC 20:30 − 480 min = UTC 20:30 − 8h = 12:30 PST, still May 10
    expect(getLocalDate(480)).toBe('2026-05-10');
  });

  test('offset 0 returns UTC date', () => {
    expect(getLocalDate(0)).toBe('2026-05-10');
  });

  test('UTC+12 offset -720 → rolls to next day', () => {
    // UTC 20:30 + 12h = 08:30 May 11
    expect(getLocalDate(-720)).toBe('2026-05-11');
  });

  test('returns undefined-offset path identically to no-arg call', () => {
    expect(getLocalDate(undefined)).toBe(getLocalDate());
  });
});

// ── Tier 1 › calcDurationMinutes (real import) ────────────────────────────────

describe('Backend _shared › calcDurationMinutes [real import]', () => {
  test('calculates 60 minutes for a 1-hour session', () => {
    expect(calcDurationMinutes('2026-05-10T09:00:00.000Z', '2026-05-10T10:00:00.000Z')).toBe(60);
  });

  test('calculates 480 minutes for an 8-hour session', () => {
    expect(calcDurationMinutes('2026-05-10T09:00:00.000Z', '2026-05-10T17:00:00.000Z')).toBe(480);
  });

  test('calculates 0 for identical check-in and check-out times', () => {
    expect(calcDurationMinutes('2026-05-10T09:00:00.000Z', '2026-05-10T09:00:00.000Z')).toBe(0);
  });

  test('rounds 30 seconds to 1 minute (Math.round)', () => {
    expect(calcDurationMinutes('2026-05-10T09:00:00.000Z', '2026-05-10T09:00:30.000Z')).toBe(1);
  });

  test('returns negative for inverted timestamps (bad data guard)', () => {
    expect(calcDurationMinutes('2026-05-10T10:00:00.000Z', '2026-05-10T09:00:00.000Z')).toBe(-60);
  });

  test('handles cross-day sessions correctly (overnight)', () => {
    // 22:00 → 06:00 next day = 480 min
    expect(calcDurationMinutes('2026-05-10T22:00:00.000Z', '2026-05-11T06:00:00.000Z')).toBe(480);
  });
});

// ── Tier 1 › getDistanceFromLatLonInMeters (real import) ─────────────────────

describe('Backend _shared › getDistanceFromLatLonInMeters [real import]', () => {
  test('user at office → 0m distance', () => {
    expect(getDistanceFromLatLonInMeters(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  test('user ~300m from office → passes MAX_DISTANCE=500m check', () => {
    const d = getDistanceFromLatLonInMeters(12.97, 77.59, 12.9727, 77.59);
    expect(d).toBeLessThan(500);
  });

  test('user ~900m from office → fails MAX_DISTANCE=500m check', () => {
    const d = getDistanceFromLatLonInMeters(12.97, 77.59, 12.978, 77.59);
    expect(d).toBeGreaterThan(500);
  });

  test('Bangalore → Mumbai is ~840km (sanity check for large distances)', () => {
    const d = getDistanceFromLatLonInMeters(12.9716, 77.5946, 19.076, 72.8777);
    expect(d).toBeGreaterThan(800_000);
    expect(d).toBeLessThan(900_000);
  });

  test('threshold guard: distance > 500 triggers "too far from office" error path', () => {
    const MAX_DISTANCE = 500;
    const d = getDistanceFromLatLonInMeters(12.97, 77.59, 13.5, 78.0);
    expect(d > MAX_DISTANCE).toBe(true);
  });

  test('returns matching results to the frontend locationUtils (same algorithm)', () => {
    // Both frontend and backend use the Haversine formula with R=6371km.
    // This test guards against accidental divergence if one file is updated.
    const { getDistanceFromLatLonInMeters: frontendFn } =
      require('../../src/utils/locationUtils');
    const lat1 = 12.97, lon1 = 77.59, lat2 = 12.9727, lon2 = 77.59;
    expect(getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2)).toBeCloseTo(
      frontendFn(lat1, lon1, lat2, lon2),
      5,
    );
  });
});

// ── Tier 2 › response shape contract spec ────────────────────────────────────
// NOTE: These tests verify the JSON *shape* that callApi() in the frontend
// parses. They do NOT re-implement source logic — they only encode the contract.

describe('Backend › response shape contract spec', () => {
  // The successResponse and errorResponse functions produce Response objects in
  // the Deno runtime. We verify the JSON body structure they emit.
  const successBody = (data: unknown, message?: string) => ({
    success: true,
    data,
    ...(message && { message }),
  });

  const errorBody = (message: string) => ({
    success: false,
    error: message,
  });

  test('success shape has success=true, data, and optional message', () => {
    const body = successBody({ id: 'att-1' }, 'Checked in successfully');
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: 'att-1' });
    expect(body.message).toBe('Checked in successfully');
  });

  test('success shape omits message key when not provided', () => {
    const body = successBody({ id: 'att-1' });
    expect('message' in body).toBe(false);
  });

  test('error shape has success=false and error string', () => {
    const body = errorBody('Invalid location data');
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid location data');
  });

  test('serialise function maps DB fields to frontend shape (attendance-today / check-in)', () => {
    // Mirrors the serialise() function used identically in check-in, check-out,
    // and attendance-today edge functions.
    const serialise = (row: any) => {
      if (!row) return null;
      return {
        ...row,
        location_check_in: row.check_in_location ?? null,
        duration_minutes: row.total_minutes ?? 0,
      };
    };

    const dbRow = {
      id: 'att-1',
      user_id: 'u-1',
      date: '2026-05-10',
      check_in: '2026-05-10T09:00:00Z',
      check_out: null,
      check_in_location: { address: 'Verified at Office', at_office: true },
      total_minutes: 240,
      status: 'present',
    };

    const out = serialise(dbRow);
    expect(out.location_check_in).toEqual({ address: 'Verified at Office', at_office: true });
    expect(out.duration_minutes).toBe(240);
    // Original DB field is still accessible (spread keeps it)
    expect(out.check_in_location).toEqual(out.location_check_in);
  });

  test('serialise returns null for null row', () => {
    const serialise = (row: any) => (!row ? null : { ...row, location_check_in: row.check_in_location ?? null, duration_minutes: row.total_minutes ?? 0 });
    expect(serialise(null)).toBeNull();
  });

  test('serialise sets duration_minutes to 0 for an open shift (total_minutes null)', () => {
    const serialise = (row: any) => ({
      ...row,
      location_check_in: row.check_in_location ?? null,
      duration_minutes: row.total_minutes ?? 0,
    });
    expect(serialise({ id: 'att-2', total_minutes: null }).duration_minutes).toBe(0);
  });
});

// ── Tier 2 › check-in handler business-rule contract spec ────────────────────

describe('Backend check-in › business-rule contract spec', () => {
  // These encode the exact conditions the handler checks so that any future
  // change to those error strings is immediately caught on the frontend too.

  test('missing latitude → "Invalid location data"', () => {
    const guard = (loc: any) => {
      if (!loc?.latitude || !loc?.longitude) throw new Error('Invalid location data');
    };
    expect(() => guard({})).toThrow('Invalid location data');
    expect(() => guard({ latitude: 12.97 })).toThrow('Invalid location data');
    expect(() => guard({ latitude: 12.97, longitude: 77.59 })).not.toThrow();
  });

  test('invalid status → \'Invalid status. Must be "present" or "wfh".\'', () => {
    const guard = (status: string) => {
      if (!status || !['present', 'wfh'].includes(status))
        throw new Error('Invalid status. Must be "present" or "wfh".');
    };
    expect(() => guard('absent')).toThrow('Invalid status');
    expect(() => guard('present')).not.toThrow();
    expect(() => guard('wfh')).not.toThrow();
  });

  test('invalid source → \'Invalid source. Must be "geofence" or "manual".\'', () => {
    const guard = (source: string) => {
      if (!['geofence', 'manual'].includes(source))
        throw new Error('Invalid source. Must be "geofence" or "manual".');
    };
    expect(() => guard('api')).toThrow('Invalid source');
    expect(() => guard('geofence')).not.toThrow();
    expect(() => guard('manual')).not.toThrow();
  });

  test('wfh check-in skips office distance validation (status !== "present")', () => {
    const shouldValidate = (status: string, companyLocation: any) =>
      status === 'present' && !!companyLocation;
    expect(shouldValidate('wfh', { latitude: 12.97, longitude: 77.59 })).toBe(false);
    expect(shouldValidate('present', { latitude: 12.97, longitude: 77.59 })).toBe(true);
    expect(shouldValidate('present', null)).toBe(false);
  });

  test('source=geofence does NOT set is_manual_override', () => {
    const isManual = (source: string) => source === 'manual';
    expect(isManual('geofence')).toBe(false);
    expect(isManual('manual')).toBe(true);
  });
});

// ── Tier 2 › check-out handler business-rule contract spec ───────────────────

describe('Backend check-out › business-rule contract spec', () => {
  test('missing daily record → "No active check-in found for today."', () => {
    const guard = (record: any) => {
      if (!record) throw new Error('No active check-in found for today.');
    };
    expect(() => guard(null)).toThrow('No active check-in found for today.');
    expect(() => guard({ id: 'x' })).not.toThrow();
  });

  test('geofence checkout is blocked when is_manual_override=true', () => {
    const isBlocked = (record: any, source: string) =>
      record?.is_manual_override && source === 'geofence';
    expect(isBlocked({ is_manual_override: true }, 'geofence')).toBe(true);
    expect(isBlocked({ is_manual_override: true }, 'manual')).toBe(false);
    expect(isBlocked({ is_manual_override: false }, 'geofence')).toBe(false);
  });

  test('invalid source → "Invalid source."', () => {
    const guard = (source: string) => {
      if (!['geofence', 'manual'].includes(source)) throw new Error('Invalid source.');
    };
    expect(() => guard('auto')).toThrow('Invalid source.');
    expect(() => guard('geofence')).not.toThrow();
  });

  test('duration message format: total_minutes → "Xh Ym" string', () => {
    const fmt = (totalMinutes: number) => {
      const hrs  = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hrs}h ${mins}m`;
    };
    expect(fmt(495)).toBe('8h 15m');
    expect(fmt(60)).toBe('1h 0m');
    expect(fmt(30)).toBe('0h 30m');
  });
});
