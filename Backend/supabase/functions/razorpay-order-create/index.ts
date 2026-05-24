import { getAuthUser } from '../_shared/supabaseAdmin.ts';
import { handleCors, successResponse, errorResponse } from '../_shared/response.ts';

const PLAN_PRICES: Record<string, number> = {
  pro_lifetime: 19900,  // INR 199.00 in paise
  auto_lifetime: 49900, // INR 499.00 in paise
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await getAuthUser(req);
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { plan_code } = body;

    if (!plan_code || !['pro_lifetime', 'auto_lifetime'].includes(plan_code)) {
      return errorResponse('Invalid plan code selected');
    }

    const amountPaise = PLAN_PRICES[plan_code];
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    // Dual-Mode Check: If no Razorpay keys are configured, fallback to Sandbox Mode
    if (!keyId || !keySecret || keyId === 'MOCK_KEY_ID') {
      const mockOrderId = `order_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
      return successResponse({
        is_sandbox: true,
        id: mockOrderId,
        amount: amountPaise,
        currency: 'INR',
        receipt: `receipt_mock_${user.id.slice(0, 8)}`,
        plan_code,
      });
    }

    // Call Real Razorpay API
    const authString = btoa(`${keyId}:${keySecret}`);
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
      }),
    });

    if (!rzpResponse.ok) {
      const errorText = await rzpResponse.text();
      throw new Error(`Razorpay Order creation failed: ${errorText}`);
    }

    const rzpOrder = await rzpResponse.json();

    return successResponse({
      is_sandbox: false,
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: rzpOrder.receipt,
      plan_code,
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errorResponse('Unauthorized', 401);
    }
    return errorResponse(error.message);
  }
});
