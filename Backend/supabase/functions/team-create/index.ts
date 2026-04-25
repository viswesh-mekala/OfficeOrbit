import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

const createTeamCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

const generateUniqueTeamCode = async (supabase: ReturnType<typeof getServiceSupabase>) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createTeamCode();
    const { data } = await supabase
      .from('teams')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!data) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique team code. Please try again.');
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);
    const body = await req.json();
    const teamName = body?.name?.trim();

    if (!teamName) {
      throw new Error('Team name is required');
    }

    const { data: existingMembership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMembership) {
      throw new Error('You are already in a team');
    }

    const teamCode = await generateUniqueTeamCode(supabase);

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamName,
        code: teamCode,
      })
      .select('*')
      .single();

    if (teamError || !team) throw teamError ?? new Error('Failed to create team');

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
      });

    if (memberError) {
      await supabase.from('teams').delete().eq('id', team.id);
      throw memberError;
    }

    return successResponse(team, 'Team created successfully');
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
