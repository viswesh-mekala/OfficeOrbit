import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);
    const body = await req.json();
    const teamCode = body?.code?.trim()?.toUpperCase();

    if (!teamCode) {
      throw new Error('Team code is required');
    }

    const { data: existingMembership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMembership) {
      throw new Error('You are already in a team');
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('code', teamCode)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) {
      throw new Error('Invalid team code');
    }

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
      });

    if (memberError) throw memberError;

    return successResponse(team, 'Joined team successfully');
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
