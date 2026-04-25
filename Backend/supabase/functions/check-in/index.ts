import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';
import { getDistanceFromLatLonInMeters } from '../_shared/locationUtils.ts';
import { getLocalDate } from '../_shared/dateUtils.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);
    const { location, status, timezoneOffset } = await req.json();

    // Validate inputs
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('Invalid location data');
    }
    if (!status || !['present', 'wfh'].includes(status)) {
      throw new Error('Invalid status. Must be "present" or "wfh".');
    }

    // 1. Get User Profile for Company Location
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_location, id')
        .eq('id', user.id)
        .single();
    
    if (profileError || !profile) throw new Error('Profile not found');

    // 2. Validate Distance — only for office check-in, skip for WFH
    const MAX_DISTANCE_METERS = 500;
    let distance = Infinity;
    let atOffice = false;

    if (profile.company_location) {
      distance = getDistanceFromLatLonInMeters(
          location.latitude,
          location.longitude,
          profile.company_location.latitude,
          profile.company_location.longitude
      );

      if (status === 'present' && distance > MAX_DISTANCE_METERS) {
        throw new Error(`You are too far from office (${Math.round(distance)}m). Try marking WFH instead.`);
      }
      atOffice = distance <= MAX_DISTANCE_METERS;
    } else {
      // No company location set — allow check-in without distance validation
      atOffice = false;
    }

    // 3. Check if already checked in today (timezone-safe)
    const today = getLocalDate(timezoneOffset);
    const { data: existingLog } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

    if (existingLog) {
      return successResponse(existingLog, 'Already checked in today');
    }

    // 4. Insert Attendance Record — privacy-safe (no raw GPS persisted)
    const { data: newLog, error: insertError } = await supabase
        .from('attendance_logs')
        .insert({
            user_id: user.id,
            date: today,
            check_in: new Date().toISOString(),
            status: status,
            location_check_in: {
              address: atOffice ? 'Verified at Office' : (profile.company_location ? 'Remote' : 'Remote (No Office Set)'),
              at_office: atOffice,
            },
        })
        .select()
        .single();

    if (insertError) throw insertError;

    return successResponse(newLog, 'Checked in successfully');

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
})
