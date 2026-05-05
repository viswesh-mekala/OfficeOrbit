import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getDistanceFromLatLonInMeters } from '../_shared/locationUtils.ts';
import { getLocalDate } from '../_shared/dateUtils.ts';

/**
 * check-in Edge Function (v2 — multi-session model)
 *
 * Called when:
 *   - Geofence ENTER confirmed (source: 'geofence')
 *   - Manual swipe on dashboard (source: 'manual')
 *
 * Behaviour:
 *   1. If day is manual-override-locked → return existing record, no changes.
 *   2. Validate location for 'present' check-ins (skip for 'wfh').
 *   3. Insert a new attendance_sessions row (entered_at = now, exited_at = NULL).
 *   4. Upsert attendance_records:
 *        - check_in  = MIN(all sessions.entered_at) — first arrival time
 *        - status    = 'present' immediately (optimistic; check-out recalculates)
 *        - is_manual_override = true if source === 'manual'
 *   5. Return serialised daily record.
 */

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase  = getServiceSupabase();
    const user      = await getAuthUser(req);
    const { location, status, timezoneOffset, source = 'geofence' } = await req.json();

    if (!location?.latitude || !location?.longitude) {
      throw new Error('Invalid location data');
    }
    if (!status || !['present', 'wfh'].includes(status)) {
      throw new Error('Invalid status. Must be "present" or "wfh".');
    }
    if (!['geofence', 'manual'].includes(source)) {
      throw new Error('Invalid source. Must be "geofence" or "manual".');
    }

    // ── 1. Get User Profile ──────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_location, minimum_login_time_minutes')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');

    // ── 2. Validate distance for office check-in ─────────────────────────────
    const MAX_DISTANCE = 500;
    let atOffice       = false;

    if (profile.company_location && status === 'present') {
      const distance = getDistanceFromLatLonInMeters(
        location.latitude,
        location.longitude,
        profile.company_location.latitude,
        profile.company_location.longitude,
      );
      if (distance > MAX_DISTANCE) {
        throw new Error(
          `You are too far from office (${Math.round(distance)}m). Try marking WFH instead.`,
        );
      }
      atOffice = true;
    }

    const today = getLocalDate(timezoneOffset);
    const now   = new Date().toISOString();

    // ── 3. Check if day is manual-override-locked ────────────────────────────
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    if (existingRecord?.is_manual_override && source === 'geofence') {
      // Day already manually overridden — geofence cannot change it
      return successResponse(serialise(existingRecord), 'Day locked by manual override');
    }

    // ── 4. Guard: no duplicate open session (GPS flicker / rapid re-entry) ───
    const { data: openSession } = await supabase
      .from('attendance_sessions')
      .select('id, entered_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('exited_at', null)
      .maybeSingle();

    if (openSession) {
      // Already inside — return the existing daily record without creating a duplicate session
      return successResponse(serialise(existingRecord), 'Session already open');
    }

    // ── 5. Create a new session row ──────────────────────────────────────────
    const { error: sessionError } = await supabase
      .from('attendance_sessions')
      .insert({
        user_id    : user.id,
        date       : today,
        entered_at : now,
        source,
      });

    if (sessionError) throw sessionError;

    // ── 6. Upsert daily record ────────────────────────────────────────────────
    const isManual  = source === 'manual';
    const checkInTime = existingRecord?.check_in
      ? (now < existingRecord.check_in ? now : existingRecord.check_in)  // keep earliest
      : now;

    const upsertPayload: Record<string, unknown> = {
      user_id          : user.id,
      date             : today,
      check_in         : checkInTime,
      status           : status,   // optimistic present / wfh
      sessions_count   : (existingRecord?.sessions_count ?? 0) + 1,
      check_in_location: {
        address  : atOffice ? 'Verified at Office' : (profile.company_location ? 'Remote' : 'Remote (No Office Set)'),
        at_office: atOffice,
      },
    };

    if (isManual) {
      upsertPayload.is_manual_override = true;
      // For manual: treat the full day as the session (check_out set on manual checkout)
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('attendance_records')
      .upsert(upsertPayload, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return successResponse(serialise(upserted), 'Checked in successfully');

  } catch (error: any) {
    if (error.message === 'Unauthorized') return errorResponse('Unauthorized', 401);
    return errorResponse(error.message);
  }
});

// Normalise DB row to the shape the frontend already expects
function serialise(row: any) {
  if (!row) return null;
  return {
    ...row,
    location_check_in: row.check_in_location ?? null,
    duration_minutes : row.total_minutes ?? 0,
  };
}
