import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getLocalDate, calcDurationMinutes } from '../_shared/dateUtils.ts';

/**
 * check-out Edge Function (v2 — multi-session model)
 *
 * Called when:
 *   - Geofence EXIT confirmed (source: 'geofence')
 *   - Manual swipe on dashboard (source: 'manual')
 *
 * Behaviour:
 *   1. If day is manual-override-locked → return existing record.
 *   2. Find the latest open session (exited_at IS NULL) and close it.
 *   3. Recalculate daily total_minutes = SUM of all completed sessions.
 *   4. Derive status using the DB helper recompute_daily_summary():
 *        total >= 50% min_login → 'present'
 *        total >  0  but below  → 'wfh'
 *        total = 0              → 'absent'
 *   5. Update attendance_records:
 *        - check_out = MAX(all sessions.exited_at)  — last departure time
 *        - total_minutes, status
 *        - is_manual_override = true if source === 'manual'
 *   6. Return serialised daily record.
 */

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user     = await getAuthUser(req);

    let timezoneOffset: number | undefined;
    let source = 'geofence';
    try {
      const body  = await req.json();
      timezoneOffset = body.timezoneOffset;
      source         = body.source ?? 'geofence';
    } catch { /* no body */ }

    if (!['geofence', 'manual'].includes(source)) {
      throw new Error('Invalid source.');
    }

    const today = getLocalDate(timezoneOffset);
    const now   = new Date().toISOString();

    // ── 1. Load today's daily record ─────────────────────────────────────────
    const { data: dailyRecord, error: fetchError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!dailyRecord) {
      throw new Error('No active check-in found for today.');
    }

    // ── 2. Manual override lock ──────────────────────────────────────────────
    if (dailyRecord.is_manual_override && source === 'geofence') {
      return successResponse(serialise(dailyRecord), 'Day locked by manual override');
    }

    // If already fully checked out via manual → return
    if (dailyRecord.check_out && dailyRecord.is_manual_override) {
      return successResponse(serialise(dailyRecord), 'Already checked out');
    }

    // ── 3. Close the latest open session ─────────────────────────────────────
    const { data: openSession, error: openErr } = await supabase
      .from('attendance_sessions')
      .select('id, entered_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('exited_at', null)
      .order('entered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openErr) throw openErr;

    if (openSession) {
      const durationMinutes = calcDurationMinutes(openSession.entered_at, now);
      const { error: closeErr } = await supabase
        .from('attendance_sessions')
        .update({ exited_at: now, duration_minutes: durationMinutes })
        .eq('id', openSession.id);

      if (closeErr) throw closeErr;
    }

    // ── 4. Recompute daily summary via DB function ────────────────────────────
    // Fetch minimum_login_time_minutes from user_profiles (not attendance_records)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('minimum_login_time_minutes')
      .eq('id', user.id)
      .single();

    const minLoginMinutes = profile?.minimum_login_time_minutes ?? 480;

    type DailySummaryRow = {
      total_minutes  : number;
      status         : string;
      first_checkin  : string | null;
      last_checkout  : string | null;
      sessions_count : number;
    };

    const { data: summaryRaw, error: summaryErr } = await supabase
      .rpc('recompute_daily_summary', {
        p_user_id               : user.id,
        p_date                  : today,
        p_minimum_login_minutes : minLoginMinutes,
      })
      .single();

    // Supabase rpc() returns unknown — cast to our known shape
    const summary = summaryRaw as DailySummaryRow;

    if (summaryErr) throw summaryErr;

    // ── 5. Determine new check_out (latest exit across all sessions) ──────────
    const newCheckOut = summary.last_checkout ?? now;

    // ── 6. Update daily record ────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      check_out      : newCheckOut,
      total_minutes  : summary.total_minutes,
      status         : summary.status,
      sessions_count : summary.sessions_count,
    };

    if (source === 'manual') {
      updatePayload.is_manual_override = true;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('attendance_records')
      .update(updatePayload)
      .eq('user_id', user.id)
      .eq('date', today)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const durationMsg = `${Math.floor((summary.total_minutes ?? 0) / 60)}h ${(summary.total_minutes ?? 0) % 60}m`;
    return successResponse(
      serialise(updated),
      `Checked out. Total today: ${durationMsg}.`,
    );

  } catch (error: any) {
    if (error.message === 'Unauthorized') return errorResponse('Unauthorized', 401);
    return errorResponse(error.message);
  }
});

function serialise(row: any) {
  if (!row) return null;
  return {
    ...row,
    location_check_in: row.check_in_location ?? null,
    duration_minutes : row.total_minutes ?? 0,
  };
}
