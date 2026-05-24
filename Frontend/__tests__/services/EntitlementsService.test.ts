import * as SecureStore from 'expo-secure-store';
import { callApi } from '../../src/services/api/apiClient';
import {
  getCachedEntitlement,
  clearCachedEntitlement,
  fetchUserEntitlement,
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from '../../src/services/billing/EntitlementsService';
import { UserEntitlement } from '../../src/types/auth.types';

// Mock expo-secure-store
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

// Mock callApi
jest.mock('../../src/services/api/apiClient', () => ({
  callApi: jest.fn(),
}));

const mockCallApi = callApi as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

describe('EntitlementsService Unit Tests', () => {
  const mockEntitlement: UserEntitlement = {
    id: 'ent-123',
    user_id: 'u-456',
    plan_code: 'pro_lifetime',
    status: 'active',
    provider: 'razorpay',
    started_at: '2026-05-24T12:00:00Z',
    is_lifetime: true,
    capabilities: {
      ads_enabled: false,
      history_days_limit: null,
      reminder_level: 'enhanced',
      background_automation_level: 'expo_background',
      auto_killed_app_support: true,
    },
  };

  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  // ── getCachedEntitlement ───────────────────────────────────────────────────
  describe('getCachedEntitlement', () => {
    test('returns parsed entitlement from cache when exists', async () => {
      mockStore.set('officeorbit_user_entitlement', JSON.stringify(mockEntitlement));
      const ent = await getCachedEntitlement();
      expect(ent).toEqual(mockEntitlement);
      expect(mockGetItem).toHaveBeenCalledWith('officeorbit_user_entitlement');
    });

    test('returns null when cache is empty', async () => {
      const ent = await getCachedEntitlement();
      expect(ent).toBeNull();
    });

    test('returns null and suppresses errors when getItemAsync throws', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('Storage failure'));
      const ent = await getCachedEntitlement();
      expect(ent).toBeNull();
    });
  });

  // ── clearCachedEntitlement ─────────────────────────────────────────────────
  describe('clearCachedEntitlement', () => {
    test('removes entitlement from cache', async () => {
      mockStore.set('officeorbit_user_entitlement', JSON.stringify(mockEntitlement));
      await clearCachedEntitlement();
      expect(mockStore.has('officeorbit_user_entitlement')).toBe(false);
      expect(mockDeleteItem).toHaveBeenCalledWith('officeorbit_user_entitlement');
    });

    test('suppresses exceptions if deleteItemAsync throws', async () => {
      mockDeleteItem.mockRejectedValueOnce(new Error('Deletion failed'));
      await expect(clearCachedEntitlement()).resolves.not.toThrow();
    });
  });

  // ── fetchUserEntitlement ───────────────────────────────────────────────────
  describe('fetchUserEntitlement', () => {
    test('fetches entitlements, caches it, and returns data', async () => {
      mockCallApi.mockResolvedValueOnce({ data: mockEntitlement, error: null });

      const { data, error } = await fetchUserEntitlement();
      expect(error).toBeNull();
      expect(data).toEqual(mockEntitlement);
      expect(mockCallApi).toHaveBeenCalledWith('entitlements-get');
      expect(mockStore.get('officeorbit_user_entitlement')).toBe(JSON.stringify(mockEntitlement));
      expect(mockSetItem).toHaveBeenCalledWith('officeorbit_user_entitlement', JSON.stringify(mockEntitlement));
    });

    test('returns error when callApi fails, without updating cache', async () => {
      mockCallApi.mockResolvedValueOnce({ data: null, error: 'Unauthorized request' });

      const { data, error } = await fetchUserEntitlement();
      expect(data).toBeNull();
      expect(error).toBe('Unauthorized request');
      expect(mockStore.has('officeorbit_user_entitlement')).toBe(false);
    });

    test('returns data even if cache storage fails', async () => {
      mockCallApi.mockResolvedValueOnce({ data: mockEntitlement, error: null });
      mockSetItem.mockRejectedValueOnce(new Error('Disk full'));

      const { data, error } = await fetchUserEntitlement();
      expect(error).toBeNull();
      expect(data).toEqual(mockEntitlement);
      // Ensure we still resolved despite setItem throwing
    });
  });

  // ── createSubscriptionOrder ────────────────────────────────────────────────
  describe('createSubscriptionOrder', () => {
    test('calls order creation endpoint with pro_lifetime plan', async () => {
      const orderPayload = {
        id: 'order_123',
        amount: 19900,
        currency: 'INR',
        receipt: 'rec-pro',
        is_sandbox: true,
        plan_code: 'pro_lifetime',
      };
      mockCallApi.mockResolvedValueOnce({ data: orderPayload, error: null });

      const { data, error } = await createSubscriptionOrder('pro_lifetime');
      expect(error).toBeNull();
      expect(data).toEqual(orderPayload);
      expect(mockCallApi).toHaveBeenCalledWith('razorpay-order-create', { plan_code: 'pro_lifetime' });
    });

    test('returns error on order creation failure', async () => {
      mockCallApi.mockResolvedValueOnce({ data: null, error: 'Payment gateway offline' });

      const { data, error } = await createSubscriptionOrder('auto_lifetime');
      expect(data).toBeNull();
      expect(error).toBe('Payment gateway offline');
    });
  });

  // ── verifySubscriptionPayment ──────────────────────────────────────────────
  describe('verifySubscriptionPayment', () => {
    const payload = {
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_456',
      razorpay_signature: 'sig_789',
      plan_code: 'pro_lifetime' as const,
    };

    test('calls signature verification endpoint, caches updated entitlement, and returns data', async () => {
      mockCallApi.mockResolvedValueOnce({ data: mockEntitlement, error: null });

      const { data, error } = await verifySubscriptionPayment(payload);
      expect(error).toBeNull();
      expect(data).toEqual(mockEntitlement);
      expect(mockCallApi).toHaveBeenCalledWith('razorpay-verify', payload);
      expect(mockStore.get('officeorbit_user_entitlement')).toBe(JSON.stringify(mockEntitlement));
      expect(mockSetItem).toHaveBeenCalledWith('officeorbit_user_entitlement', JSON.stringify(mockEntitlement));
    });

    test('returns verification error when signature check fails', async () => {
      mockCallApi.mockResolvedValueOnce({ data: null, error: 'Signature mismatch' });

      const { data, error } = await verifySubscriptionPayment(payload);
      expect(data).toBeNull();
      expect(error).toBe('Signature mismatch');
      expect(mockStore.has('officeorbit_user_entitlement')).toBe(false);
    });
  });
});
