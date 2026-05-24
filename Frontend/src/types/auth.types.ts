import { Session, User } from '@supabase/supabase-js';

// ── Data Models ──

export interface CompanyLocation {
    latitude: number;
    longitude: number;
    address: string;
}

export interface UserProfile {
    id: string;
    username: string;
    email: string;
    company: string | null;
    company_location: CompanyLocation | null;
    office_window_start: string | null;
    office_window_end: string | null;
    minimum_login_time_minutes: number | null;
    office_days_target: number | null;
    office_target_period: 'week' | 'month' | null;
    // Legacy field names retained for backward compatibility.
    wfh_days: number | null;
    wfh_period: 'week' | 'month' | null;
    created_at: string;
    updated_at: string;
}

export interface PlanCapabilities {
    ads_enabled: boolean;
    history_days_limit: number | null;
    reminder_level: 'basic' | 'enhanced';
    background_automation_level: 'none' | 'expo_background';
    auto_killed_app_support: boolean;
}

export interface UserEntitlement {
    id: string;
    user_id: string;
    plan_code: 'free' | 'pro_lifetime' | 'auto_lifetime';
    status: 'active' | 'revoked' | 'refunded' | 'grace';
    provider: 'razorpay' | 'play' | 'apple' | 'manual';
    started_at: string;
    is_lifetime: boolean;
    capabilities: PlanCapabilities;
}

// ── Context State ──

export interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    entitlement: UserEntitlement | null;
    loading: boolean;
    profileLoading: boolean;
    entitlementLoading: boolean;
    isProfileComplete: boolean;
    signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUpWithEmail: (email: string, password: string, username: string) => Promise<{ 
        error: Error | null; 
        data: any; 
        needsEmailConfirmation: boolean;
    }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
    resendOtp: (email: string) => Promise<{ error: Error | null }>;
    updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>;
    refreshProfile: () => Promise<void>;
    refreshEntitlements: () => Promise<void>;
    signOut: () => Promise<void>;
}
