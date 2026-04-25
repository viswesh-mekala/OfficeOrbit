/**
 * Standard API response helpers for all Edge Functions.
 * Ensures consistent JSON shape and CORS headers across the API.
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

/** Preflight response for CORS OPTIONS requests */
export const handleCors = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
};

/** Success response — { success: true, data, message? } */
export const successResponse = (data: unknown, message?: string): Response => {
  return new Response(
    JSON.stringify({ success: true, data, ...(message && { message }) }),
    { headers: jsonHeaders, status: 200 }
  );
};

/** Error response — { success: false, error } */
export const errorResponse = (message: string, status = 400): Response => {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { headers: jsonHeaders, status }
  );
};
