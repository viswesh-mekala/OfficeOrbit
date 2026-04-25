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
        .from('attendance_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    if (error) {
      // Not found is a valid state (no check-in yet)
      if (error.code === 'PGRST116') {
        return successResponse(null);
      }
      throw error;
    }

    return successResponse(data);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
})
