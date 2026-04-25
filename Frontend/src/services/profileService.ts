import { callApi } from './api/apiClient';
import { UserProfile } from '../types/auth.types';

/**
 * Profile Service — all profile operations through Edge Functions.
 * No direct database access.
 */

// ── Fetch Profile ──
export const fetchUserProfile = async (
    _userId: string,
    retryCount = 0
): Promise<{ data: UserProfile | null; error: string | null; shouldClearSession: boolean }> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1500;

    const { data, error } = await callApi<UserProfile>('profile-get');

    if (error) {
        // Auth errors → signal to clear session
        const msg = error.toLowerCase();
        if (
            msg.includes('unauthorized') ||
            msg.includes('jwt') ||
            msg.includes('token')
        ) {
            console.warn('[Auth] Session invalid, clearing...');
            return { data: null, error: null, shouldClearSession: true };
        }

        // Profile not found yet (DB trigger race) → silent retry
        const isRetryable =
            msg.includes('not found') ||
            msg.includes('schema') ||
            msg.includes('does not exist');

        if (isRetryable && retryCount < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return fetchUserProfile(_userId, retryCount + 1);
        }

        return { data: null, error: null, shouldClearSession: false };
    }

    return { data, error: null, shouldClearSession: false };
};

// ── Update Profile ──
export const updateUserProfile = async (
    _userId: string,
    profileData: Partial<UserProfile>
): Promise<{ error: Error | null }> => {
    const { error } = await callApi('profile-update', profileData);

    if (error) {
        return { error: new Error(error) };
    }
    return { error: null };
};

// ── Check if profile has all required fields (pure function — no API call) ──
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
