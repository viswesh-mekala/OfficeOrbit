import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);
    const body = await req.json();

    // Validate required fields
    if (!body || typeof body !== 'object') {
      throw new Error('Invalid request body');
    }

    // Remove fields that shouldn't be updated by the client
    // deno-lint-ignore no-unused-vars
    const { id: _id, created_at: _created_at, email: _email, ...updateData } = body;

    // Upsert (not update) — handles the case where the profile row doesn't exist
    // yet on a fresh DB (trigger only fires on new signups, not existing auth users)
    const { data: updated, error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? '',
            username: updateData.username ?? user.email?.split('@')[0] ?? 'User',
            ...updateData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        .select()
        .single();

    if (error) throw error;

    return successResponse(updated, 'Profile updated successfully');


  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
})
