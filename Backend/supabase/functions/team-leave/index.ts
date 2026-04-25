import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('id, team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return successResponse(null, 'You are not in a team');
    }

    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', membership.id);

    if (deleteError) throw deleteError;

    const { count, error: countError } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', membership.team_id);

    if (countError) throw countError;

    if (!count) {
      await supabase
        .from('teams')
        .delete()
        .eq('id', membership.team_id);
    }

    return successResponse(null, 'Left team successfully');
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
