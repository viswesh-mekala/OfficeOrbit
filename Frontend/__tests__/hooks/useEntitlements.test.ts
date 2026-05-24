import { renderHook } from '@testing-library/react-native';
import { useEntitlements } from '../../src/hooks/useEntitlements';
import { useAuth } from '../../src/store/AuthContext';
import { UserEntitlement } from '../../src/types/auth.types';

// Mock useAuth
jest.mock('../../src/store/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

describe('useEntitlements React Hook Unit Tests', () => {
  const mockFreeCapabilities = {
    ads_enabled: true,
    history_days_limit: 30,
    reminder_level: 'basic' as const,
    background_automation_level: 'none' as const,
    auto_killed_app_support: false,
  };

  const mockPremiumCapabilities = {
    ads_enabled: false,
    history_days_limit: null,
    reminder_level: 'enhanced' as const,
    background_automation_level: 'expo_background' as const,
    auto_killed_app_support: true,
  };

  const mockEntitlement = (plan: 'free' | 'pro_lifetime' | 'auto_lifetime'): UserEntitlement => ({
    id: 'ent-123',
    user_id: 'u-456',
    plan_code: plan,
    status: 'active',
    provider: 'razorpay',
    started_at: '2026-05-24T12:00:00Z',
    is_lifetime: true,
    capabilities: plan === 'free' ? mockFreeCapabilities : mockPremiumCapabilities,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. Resolves default "free" capabilities when no entitlement is active', () => {
    mockUseAuth.mockReturnValueOnce({
      entitlement: null,
      entitlementLoading: false,
      refreshEntitlements: jest.fn(),
    });

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.planCode).toBe('free');
    expect(result.current.status).toBe('active');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isAuto).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.capabilities).toEqual(mockFreeCapabilities);
  });

  test('2. Resolves active "free" entitlement correctly', () => {
    mockUseAuth.mockReturnValueOnce({
      entitlement: mockEntitlement('free'),
      entitlementLoading: false,
      refreshEntitlements: jest.fn(),
    });

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.planCode).toBe('free');
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isAuto).toBe(false);
    expect(result.current.capabilities.ads_enabled).toBe(true);
    expect(result.current.capabilities.history_days_limit).toBe(30);
  });

  test('3. Resolves active "pro_lifetime" premium tier correctly', () => {
    mockUseAuth.mockReturnValueOnce({
      entitlement: mockEntitlement('pro_lifetime'),
      entitlementLoading: false,
      refreshEntitlements: jest.fn(),
    });

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.planCode).toBe('pro_lifetime');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isAuto).toBe(false);
    expect(result.current.capabilities.ads_enabled).toBe(false);
    expect(result.current.capabilities.history_days_limit).toBeNull();
  });

  test('4. Resolves active "auto_lifetime" premium tier correctly', () => {
    mockUseAuth.mockReturnValueOnce({
      entitlement: mockEntitlement('auto_lifetime'),
      entitlementLoading: false,
      refreshEntitlements: jest.fn(),
    });

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.planCode).toBe('auto_lifetime');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isAuto).toBe(true);
    expect(result.current.capabilities.ads_enabled).toBe(false);
    expect(result.current.capabilities.background_automation_level).toBe('expo_background');
  });

  test('5. Passes loading state and refresh triggers transparently', () => {
    const mockRefresh = jest.fn();
    mockUseAuth.mockReturnValueOnce({
      entitlement: null,
      entitlementLoading: true,
      refreshEntitlements: mockRefresh,
    });

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.loading).toBe(true);
    result.current.refreshEntitlements();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
