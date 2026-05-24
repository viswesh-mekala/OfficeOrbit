import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

// Dynamic capability maps based on tier
const CAPABILITIES_MAP: Record<string, any> = {
  free: {
    ads_enabled: true,
    history_days_limit: 30,
    reminder_level: 'basic',
    background_automation_level: 'none',
    auto_killed_app_support: false,
  },
  pro_lifetime: {
    ads_enabled: false,
    history_days_limit: null, // Unlimited
    reminder_level: 'enhanced',
    background_automation_level: 'expo_background',
    auto_killed_app_support: false,
  },
  auto_lifetime: {
    ads_enabled: false,
    history_days_limit: null, // Unlimited
    reminder_level: 'enhanced',
    background_automation_level: 'expo_background',
    auto_killed_app_support: true,
  },
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    // Fetch user entitlement
    let { data: entitlement, error } = await supabase
      .from('user_entitlements')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    // Backward-compatibility: If no entitlement exists, register 'free' tier
    if (!entitlement) {
      const { data: newEntitlement, error: insertError } = await supabase
        .from('user_entitlements')
        .insert({
          user_id: user.id,
          plan_code: 'free',
          status: 'active',
          provider: 'manual',
          is_lifetime: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      entitlement = newEntitlement;
    }

    // Resolve capabilities
    const capabilities = CAPABILITIES_MAP[entitlement.plan_code] || CAPABILITIES_MAP.free;

    return successResponse({
      id: entitlement.id,
      user_id: entitlement.user_id,
      plan_code: entitlement.plan_code,
      status: entitlement.status,
      provider: entitlement.provider,
      started_at: entitlement.started_at,
      is_lifetime: entitlement.is_lifetime,
      capabilities,
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
