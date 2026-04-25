import { supabase } from './api/supabaseClient';
import { friendlyErrorMessage } from '../utils/errorHandler';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// Ensure web browser redirects are handled
WebBrowser.maybeCompleteAuthSession();

/**
 * Auth Service — all authentication-related Supabase calls.
 * Pure async functions, no React state.
 */

// ── Sign In ──
export const signInWithEmail = async (email: string, password: string) => {
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { error: null };
    } catch (error: any) {
        return { error: new Error(friendlyErrorMessage(error.message || 'Sign in failed')) };
    }
};

// ── Sign Up ──
export const signUpWithEmail = async (email: string, password: string, username: string) => {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name: username },
                emailRedirectTo: undefined,
            },
        });
        if (error) throw error;
        
        return { 
            error: null, 
            data,
            needsEmailConfirmation: !data.session
        };
    } catch (error: any) {
        return { 
            error: new Error(friendlyErrorMessage(error.message || 'Sign up failed')), 
            data: null, 
            needsEmailConfirmation: false 
        };
    }
};

// ── Google OAuth ──
export const signInWithGoogle = async () => {
    try {
        const redirectUrl = makeRedirectUri({
            scheme: 'officeorbit',
            path: 'auth/callback',
        });

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;

        if (data?.url) {
            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

            if (result.type === 'success' && result.url) {
                // Parse hash fragment manually — new URL() crashes on custom schemes
                const hashIndex = result.url.indexOf('#');
                if (hashIndex === -1) {
                    throw new Error('No tokens in OAuth response');
                }

                const hashString = result.url.substring(hashIndex + 1);
                const params = new URLSearchParams(hashString);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                    await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    return { error: null };
                } else {
                    const errorMsg = params.get('error_description') || params.get('error');
                    if (errorMsg) throw new Error(errorMsg);
                    throw new Error('No tokens received from OAuth');
                }
            } else if (result.type === 'cancel' || result.type === 'dismiss') {
                return { error: null };
            }
        }

        return { error: new Error('Google sign-in could not be started. Please try again.') };
    } catch (error: any) {
        return { error: new Error(friendlyErrorMessage(error.message || 'Google sign in failed')) };
    }
};

// ── OTP Verification ──
export const verifyOtp = async (email: string, token: string) => {
    try {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
        if (error) throw error;
        return { error: null };
    } catch (error: any) {
        return { error: new Error(friendlyErrorMessage(error.message || 'Verification failed')) };
    }
};

// ── Resend OTP ──
export const resendOtp = async (email: string) => {
    try {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw error;
        return { error: null };
    } catch (error: any) {
        return { error: new Error(friendlyErrorMessage(error.message || 'Failed to resend code')) };
    }
};

// ── Sign Out ──
export const signOutUser = async () => {
    try {
        await supabase.auth.signOut();
    } catch (_err) {}
};

// ── Session helpers ──
export const getSession = () => supabase.auth.getSession();
export const getUser = () => supabase.auth.getUser();
export const onAuthStateChange = (callback: (event: string, session: any) => void) =>
    supabase.auth.onAuthStateChange(callback);
export const forceSignOut = async () => {
    try { await supabase.auth.signOut(); } catch (_) {}
};
