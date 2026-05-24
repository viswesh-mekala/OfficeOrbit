import * as SecureStore from 'expo-secure-store';
import { callApi } from '../api/apiClient';
import { UserEntitlement } from '../../types/auth.types';

const ENTITLEMENT_CACHE_KEY = 'officeorbit_user_entitlement';

/**
 * Entitlements Service — Handles subscription plans, payments, and capabilities.
 * Caches entitlements in SecureStore for instantaneous startup and offline support.
 */

/** Get the locally cached entitlement snapshot */
export const getCachedEntitlement = async (): Promise<UserEntitlement | null> => {
  try {
    const cached = await SecureStore.getItemAsync(ENTITLEMENT_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (_e) {
    return null;
  }
};

/** Clear the locally cached entitlement (called on sign-out) */
export const clearCachedEntitlement = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(ENTITLEMENT_CACHE_KEY);
  } catch (_e) {
    // Ignore error
  }
};

/** Fetch fresh entitlements from the server and update local cache */
export const fetchUserEntitlement = async (): Promise<{
  data: UserEntitlement | null;
  error: string | null;
}> => {
  const { data, error } = await callApi<UserEntitlement>('entitlements-get');

  if (data && !error) {
    try {
      await SecureStore.setItemAsync(ENTITLEMENT_CACHE_KEY, JSON.stringify(data));
    } catch (_e) {
      // Storage failed, but continue returning the data
    }
  }

  return { data, error };
};

/** Create a new Razorpay/Sandbox subscription order */
export const createSubscriptionOrder = async (
  planCode: 'pro_lifetime' | 'auto_lifetime'
): Promise<{
  data: {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    is_sandbox: boolean;
    plan_code: typeof planCode;
  } | null;
  error: string | null;
}> => {
  return await callApi('razorpay-order-create', { plan_code: planCode });
};

/** Verify the completed Razorpay/Sandbox subscription payment */
export const verifySubscriptionPayment = async (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
  plan_code: 'pro_lifetime' | 'auto_lifetime';
}): Promise<{
  data: UserEntitlement | null;
  error: string | null;
}> => {
  const { data, error } = await callApi<UserEntitlement>('razorpay-verify', payload);

  if (data && !error) {
    try {
      await SecureStore.setItemAsync(ENTITLEMENT_CACHE_KEY, JSON.stringify(data));
    } catch (_e) {
      // Storage failed
    }
  }

  return { data, error };
};
