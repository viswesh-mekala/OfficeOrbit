import { useAuth } from '../store/AuthContext';
import { PlanCapabilities } from '../types/auth.types';

const DEFAULT_FREE_CAPABILITIES: PlanCapabilities = {
  ads_enabled: true,
  history_days_limit: 30,
  reminder_level: 'basic',
  background_automation_level: 'none',
  auto_killed_app_support: false,
};

/**
 * useEntitlements — Simple, capability-driven React hook.
 * Avoid scatterings of "planCode === 'pro'" checks. Use "capabilities.ads_enabled" instead.
 */
export const useEntitlements = () => {
  const { entitlement, entitlementLoading, refreshEntitlements } = useAuth();

  const planCode = entitlement?.plan_code ?? 'free';
  const status = entitlement?.status ?? 'active';
  const isPremium = planCode === 'pro_lifetime' || planCode === 'auto_lifetime';
  const isAuto = planCode === 'auto_lifetime';

  return {
    entitlement,
    planCode,
    status,
    isPremium,
    isAuto,
    loading: entitlementLoading,
    capabilities: entitlement?.capabilities ?? DEFAULT_FREE_CAPABILITIES,
    refreshEntitlements,
  };
};
export default useEntitlements;
