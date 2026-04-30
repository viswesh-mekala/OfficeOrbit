import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

const ALLOWED_STATUSES = ['present', 'wfh', 'leave', 'holiday', 'absent'] as const;
type AttendanceStatus = typeof ALLOWED_STATUSES[number];

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);
    const { date, status } = await req.json();

    if (!date || typeof date !== 'string') {
      throw new Error('Invalid date. Expected YYYY-MM-DD.');
    }
    if (!status || !ALLOWED_STATUSES.includes(status as AttendanceStatus)) {
      throw new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
    }

    const { data: existingLog, error: fetchError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const isOffDayStatus = status === 'holiday' || status === 'leave' || status === 'absent';

    if (existingLog) {
      const updatePayload: Record<string, unknown> = { status };

      // Clearing timings prevents wrong duration/count after manual off-day correction.
      if (isOffDayStatus) {
        updatePayload.check_in = null;
        updatePayload.check_out = null;
        updatePayload.total_minutes = 0;
        updatePayload.check_in_location = null;
      }

      const { data: updatedLog, error: updateError } = await supabase
        .from('attendance_records')
        .update(updatePayload)
        .eq('id', existingLog.id)
        .select()
        .single();

      if (updateError) throw updateError;
      const serializedUpdated = {
        ...updatedLog,
        location_check_in: updatedLog.check_in_location ?? null,
        duration_minutes: updatedLog.total_minutes ?? 0,
      };
      return successResponse(serializedUpdated, 'Attendance day updated');
    }

    const { data: createdLog, error: createError } = await supabase
      .from('attendance_records')
      .insert({
        user_id: user.id,
        date,
        status,
      })
      .select()
      .single();

    if (createError) throw createError;
    const serializedCreated = {
      ...createdLog,
      location_check_in: createdLog.check_in_location ?? null,
      duration_minutes: createdLog.total_minutes ?? 0,
    };
    return successResponse(serializedCreated, 'Attendance day created');
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
