import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getLocalDate } from '../_shared/dateUtils.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    let timezoneOffset: number | undefined;
    try {
      const body = await req.json();
      timezoneOffset = body?.timezoneOffset;
    } catch {
      // No body provided, fall back to UTC.
    }

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership) {
      return successResponse({
        team: null,
        members: [],
      });
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, code, created_at')
      .eq('id', membership.team_id)
      .single();

    if (teamError) {
      if (teamError.code === 'PGRST116') {
        return successResponse({
          team: null,
          members: [],
        });
      }
      throw teamError;
    }

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        user_id,
        joined_at,
        user_profiles!team_members_user_id_fkey (
          username,
          email
        )
      `)
      .eq('team_id', membership.team_id)
      .order('joined_at', { ascending: true });

    if (membersError) throw membersError;

    const memberIds = (members ?? []).map((member: any) => member.user_id);
    const today = getLocalDate(timezoneOffset);

    let attendanceLogs: any[] = [];
    if (memberIds.length > 0) {
      const attendanceResponse = await supabase
        .from('attendance_records')
        .select('user_id, status, check_in, check_out')
        .in('user_id', memberIds)
        .eq('date', today);

      if (attendanceResponse.error) throw attendanceResponse.error;
      attendanceLogs = attendanceResponse.data ?? [];
    }

    const attendanceByUserId = new Map(
      attendanceLogs.map((log: any) => [log.user_id, log]),
    );

    const serializedMembers = (members ?? []).map((member: any) => {
      const profile = member.user_profiles;
      const attendance = attendanceByUserId.get(member.user_id);
      const dayOfWeek = new Date(today).getDay();

      let attendanceStatus = 'home';
      if (attendance?.status === 'present') {
        attendanceStatus = 'office';
      } else if (attendance?.status === 'wfh') {
        attendanceStatus = 'home';
      } else if (attendance?.status === 'absent') {
        attendanceStatus = 'home';
      } else if (attendance?.status === 'leave') {
        attendanceStatus = 'leave';
      } else if (attendance?.status === 'holiday') {
        attendanceStatus = 'holiday';
      } else if (!attendance && (dayOfWeek === 0 || dayOfWeek === 6)) {
        attendanceStatus = 'weekend';
      }

      return {
        id: member.user_id,
        name: profile?.username ?? 'Unknown Member',
        email: profile?.email ?? '',
        attendanceStatus,
        checkedInAt: attendance?.check_in ?? null,
        checkedOutAt: attendance?.check_out ?? null,
        joinedAt: member.joined_at,
        isCurrentUser: member.user_id === user.id,
      };
    });

    return successResponse({
      team,
      members: serializedMembers,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
