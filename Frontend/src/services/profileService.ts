import { supabase } from './api/supabaseClient';
import { friendlyErrorMessage } from '../utils/errorHandler';
import { UserProfile } from '../types/auth.types';

/**
 * Profile Service — all profile-related Supabase calls.
 * Pure async functions, no React state.
 */

// ── Fetch Profile with retry (handles DB trigger race condition) ──
export const fetchUserProfile = async (
    userId: string,
    retryCount = 0
): Promise<{ data: UserProfile | null; error: string | null; shouldClearSession: boolean }> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1500;

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            // Auth errors (user deleted from Supabase) → signal to clear session
            if (
                error.message.includes('JWT') ||
                error.message.includes('token') ||
                error.code === '401' ||
                error.code === 'PGRST301'
            ) {
                console.warn('[Auth] Session invalid, clearing...');
                return { data: null, error: null, shouldClearSession: true };
            }

            // Profile not found yet (DB trigger hasn't created it) → silent retry
            const isNotFound = error.code === 'PGRST116';
            const isSchemaIssue =
                error.message.includes('schema cache') ||
                error.message.includes('does not exist');
            const isRetryable = isNotFound || isSchemaIssue;

            if (isRetryable && retryCount < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                return fetchUserProfile(userId, retryCount + 1);
            }

            if (!isNotFound) {
                console.warn('[Profile] Fetch error:', error.message);
            }
            return { data: null, error: null, shouldClearSession: false };
        }

        return { data: data as UserProfile, error: null, shouldClearSession: false };
    } catch (_err) {
        // Network errors — silent
        return { data: null, error: null, shouldClearSession: false };
    }
};

// ── Update Profile ──
export const updateUserProfile = async (
    userId: string,
    data: Partial<UserProfile>
): Promise<{ error: Error | null }> => {
    try {
        const { error } = await supabase
            .from('user_profiles')
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (error) throw error;
        return { error: null };
    } catch (error: any) {
        return {
            error: new Error(friendlyErrorMessage(error.message || 'Failed to save profile')),
        };
    }
};

// ── Check if profile has all required fields ──
export const checkProfileComplete = (profile: UserProfile | null): boolean => {
    if (!profile) return false;
    const loc = profile.company_location;
    const hasLocation = loc && loc.latitude != null && loc.longitude != null && !!loc.address;
    return !!(
        profile.username &&
        profile.company &&
        hasLocation &&
        profile.office_window_start &&
        profile.office_window_end &&
        profile.minimum_login_time_minutes != null &&
        profile.wfh_days != null &&
        profile.wfh_period
    );
};
