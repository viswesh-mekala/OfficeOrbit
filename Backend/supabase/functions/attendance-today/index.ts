import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getLocalDate } from '../_shared/dateUtils.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    // Parse timezone offset from body (optional)
    let timezoneOffset: number | undefined;
    try {
      const body = await req.json();
      timezoneOffset = body.timezoneOffset;
    } catch {
      // No body or invalid JSON — use UTC fallback
    }

    const today = getLocalDate(timezoneOffset);

    const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();  // returns null (not an error) when no record exists yet

    if (error) throw error;

    const serialized = data
      ? {
          ...data,
          location_check_in: data.check_in_location ?? null,
          duration_minutes: data.total_minutes ?? 0,
        }
      : null;
    return successResponse(serialized);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
})
