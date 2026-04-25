import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getLocalDate, calcDurationMinutes } from '../_shared/dateUtils.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    // Parse timezone offset from body
    let timezoneOffset: number | undefined;
    try {
      const body = await req.json();
      timezoneOffset = body.timezoneOffset;
    } catch {
      // No body — use UTC fallback
    }

    // 1. Get Today's Log (timezone-safe)
    const today = getLocalDate(timezoneOffset);
    const { data: existingLog, error: fetchError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    if (fetchError || !existingLog) {
      throw new Error('No active check-in found for today.');
    }

    if (existingLog.check_out) {
      return successResponse(existingLog, 'Already checked out');
    }

    // 2. Calculate duration and update check-out time
    const now = new Date().toISOString();
    const durationMinutes = calcDurationMinutes(existingLog.check_in, now);

    const { data: updatedLog, error: updateError } = await supabase
        .from('attendance_logs')
        .update({
            check_out: now,
            duration_minutes: durationMinutes,
        })
        .eq('id', existingLog.id)
        .select()
        .single();

    if (updateError) throw updateError;

    return successResponse(updatedLog, `Checked out successfully. Duration: ${durationMinutes} minutes.`);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
})
