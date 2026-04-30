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

// ── Context State ──

export interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    loading: boolean;
    profileLoading: boolean;
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
    signOut: () => Promise<void>;
}
