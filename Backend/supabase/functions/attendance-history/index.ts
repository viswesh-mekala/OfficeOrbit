import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    // Fetch user entitlement to check plan limits
    let planCode = 'free';
    try {
      const { data: entitlement } = await supabase
        .from('user_entitlements')
        .select('plan_code')
        .eq('user_id', user.id)
        .maybeSingle();
      if (entitlement) {
        planCode = entitlement.plan_code;
      }
    } catch (_e) {
      // Default to free on error
    }

    // Parse optional limit from body
    let limit = 7;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number' && body.limit > 0) {
        // Enforce hard server caps: free is strictly bounded to 30 days, others up to 400
        const maxLimit = planCode === 'free' ? 30 : 400;
        limit = Math.min(body.limit, maxLimit);
      }
    } catch {
      // No body — use default. Enforce 30 day hard cap for free if limit defaults somehow
      if (planCode === 'free') {
        limit = Math.min(limit, 30);
      }
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
