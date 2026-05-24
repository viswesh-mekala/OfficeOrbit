import { getServiceSupabase, getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

// Helper to calculate HmacSHA256 using native Web Crypto
async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(`${orderId}|${paymentId}`);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return computedSignature === signature;
  } catch (_e) {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceSupabase();
    const user = await getAuthUser(req);

    // Parse payload
    const body = await req.json().catch(() => ({}));
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_code,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !plan_code) {
      return errorResponse('Missing required payment verification details');
    }

    if (!['pro_lifetime', 'auto_lifetime'].includes(plan_code)) {
      return errorResponse('Invalid entitlement plan code');
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const isSandboxOrder = razorpay_order_id.startsWith('order_mock_');

    // 1. DUAL-MODE SIGNATURE CHECK
    if (!keyId || !keySecret || keyId === 'MOCK_KEY_ID' || isSandboxOrder) {
      // Sandbox validation: mock passes if IDs match naming patterns
      if (!isSandboxOrder) {
        return errorResponse('Sandbox order id mismatch');
      }
    } else {
      // Real transaction validation
      if (!razorpay_signature) {
        return errorResponse('Missing payment signature');
      }

      const isValid = await verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        keySecret
      );

      if (!isValid) {
        return errorResponse('Invalid payment signature. Verification failed.');
      }
    }

    // 2. AUDIT LOGGING: Insert billing event record
    const { error: logError } = await supabase.from('billing_events').insert({
      user_id: user.id,
      provider: 'razorpay',
      event_type: 'payment.success',
      provider_event_id: razorpay_payment_id,
      payload: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        plan_code,
        status: 'success',
        mode: isSandboxOrder ? 'sandbox' : 'live',
      },
    });

    if (logError && logError.code !== '23505') {
      // Ignore unique constraint violation (idempotency safety)
      throw logError;
    }

    // 3. SECURE ENTITLEMENT PROVISIONING
    const { data: updatedEntitlement, error: entitlementError } = await supabase
      .from('user_entitlements')
      .upsert(
        {
          user_id: user.id,
          plan_code,
          status: 'active',
          provider: 'razorpay',
          provider_order_id: razorpay_order_id,
          provider_payment_id: razorpay_payment_id,
          is_lifetime: true,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (entitlementError) throw entitlementError;

    // Resolve capabilities
    const CAPABILITIES_MAP: Record<string, any> = {
      pro_lifetime: {
        ads_enabled: false,
        history_days_limit: null,
        reminder_level: 'enhanced',
        background_automation_level: 'expo_background',
        auto_killed_app_support: false,
      },
      auto_lifetime: {
        ads_enabled: false,
        history_days_limit: null,
        reminder_level: 'enhanced',
        background_automation_level: 'expo_background',
        auto_killed_app_support: true,
      },
    };

    return successResponse({
      id: updatedEntitlement.id,
      user_id: updatedEntitlement.user_id,
      plan_code: updatedEntitlement.plan_code,
      status: updatedEntitlement.status,
      provider: updatedEntitlement.provider,
      started_at: updatedEntitlement.started_at,
      is_lifetime: updatedEntitlement.is_lifetime,
      capabilities: CAPABILITIES_MAP[plan_code],
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
