import { createClient } from '@supabase/supabase-js';

/**
 * Shared Supabase admin client and auth helpers.
 * - getServiceSupabase(): Uses service_role key — bypasses RLS for admin operations.
 * - getAuthUser(req): Validates the user's JWT from the Authorization header.
 */

export const getServiceSupabase = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  return createClient(supabaseUrl, supabaseServiceKey);
};

export const getAuthUser = async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  
  // Create a client with the user's JWT to inspect their session
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
};
