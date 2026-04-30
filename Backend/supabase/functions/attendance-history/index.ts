import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    // Parse optional limit from body
    let limit = 7;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number' && body.limit > 0) {
        limit = Math.min(body.limit, 90); // Cap at 90 days
      }
    } catch {
      // No body — use default
    }

    const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(limit);

    if (error) throw error;

    const serialized = (data || []).map((row: any) => ({
      ...row,
      location_check_in: row.check_in_location ?? null,
      duration_minutes: row.total_minutes ?? 0,
    }));
    return successResponse(serialized);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
})
