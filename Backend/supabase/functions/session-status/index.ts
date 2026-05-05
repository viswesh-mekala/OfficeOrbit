import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getLocalDate } from '../_shared/dateUtils.ts';

/**
 * session-status Edge Function
 *
 * Returns everything the UI needs to display today's attendance in one call:
 *   - daily_record  : the attendance_records row (check_in, check_out, status, total_minutes, …)
 *   - sessions      : list of all attendance_sessions for today (for timeline view)
 *   - live_duration_minutes : total_minutes of completed sessions
 *                             + elapsed minutes of any currently-open session
 *   - is_inside     : true if there is an open session right now
 *
 * This is the primary data source for the dashboard live timer and
 * the attendance screen day-detail session timeline.
 */

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user     = await getAuthUser(req);

    let timezoneOffset: number | undefined;
    try {
      const body     = await req.json();
      timezoneOffset = body.timezoneOffset;
    } catch { /* no body */ }

    const today = getLocalDate(timezoneOffset);
    const nowMs = Date.now();

    // ── 1. Fetch today's daily record ─────────────────────────────────────────
    const { data: dailyRecord } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    // ── 2. Fetch all sessions for today (newest first for UI) ─────────────────
    const { data: sessions, error: sessionsErr } = await supabase
      .from('attendance_sessions')
      .select('id, entered_at, exited_at, duration_minutes, source')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('entered_at', { ascending: true });

    if (sessionsErr) throw sessionsErr;

    const allSessions = sessions ?? [];

    // ── 3. Compute live duration ──────────────────────────────────────────────
    // Sum completed session minutes
    const completedMinutes = allSessions
      .filter((s) => s.exited_at !== null)
      .reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);

    // Add elapsed time of any open session
    const openSession = allSessions.find((s) => s.exited_at === null) ?? null;
    const openMinutes = openSession
      ? Math.floor((nowMs - new Date(openSession.entered_at).getTime()) / 60_000)
      : 0;

    const liveDurationMinutes = completedMinutes + openMinutes;

    // ── 4. Serialise and respond ──────────────────────────────────────────────
    const serialisedRecord = dailyRecord
      ? {
          ...dailyRecord,
          location_check_in: dailyRecord.check_in_location ?? null,
          duration_minutes : dailyRecord.total_minutes ?? 0,
        }
      : null;

    return successResponse({
      daily_record         : serialisedRecord,
      sessions             : allSessions,
      live_duration_minutes: liveDurationMinutes,
      is_inside            : openSession !== null,
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') return errorResponse('Unauthorized', 401);
    return errorResponse(error.message);
  }
});
