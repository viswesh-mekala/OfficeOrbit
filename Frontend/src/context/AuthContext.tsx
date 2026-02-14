import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

// Ensure web browser redirects are handled
WebBrowser.maybeCompleteAuthSession();

// ── Friendly Error Messages ──
// Maps raw Supabase/API errors to user-friendly messages (like Flipkart/Amazon)
const friendlyErrorMessage = (rawMessage: string): string => {
    const msg = rawMessage.toLowerCase();

    // Auth errors
    if (msg.includes('invalid login credentials')) return 'Incorrect email or password. Please try again.';
    if (msg.includes('email not confirmed')) return 'Please verify your email address first.';
    if (msg.includes('user already registered')) return 'This email is already registered. Try signing in.';
    if (msg.includes('invalid email')) return 'Please enter a valid email address.';
    if (msg.includes('password') && msg.includes('6')) return 'Password must be at least 6 characters.';
    if (msg.includes('signup is disabled')) return 'Sign up is temporarily disabled. Please try again later.';
    if (msg.includes('email rate limit')) return 'Too many attempts. Please wait a few minutes.';
    if (msg.includes('rate limit')) return 'Too many requests. Please wait and try again.';
    
    // OTP errors
    if (msg.includes('token has expired') || msg.includes('otp has expired')) return 'This code has expired. Please request a new one.';
    if (msg.includes('invalid') && msg.includes('otp')) return 'Invalid verification code. Please check and try again.';
    if (msg.includes('invalid') && msg.includes('token')) return 'Invalid verification code. Please check and try again.';

    // Network/connectivity
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) return 'Network error. Please check your connection and try again.';
    if (msg.includes('failed to fetch')) return 'Unable to connect. Please check your internet connection.';
    
    // Database
    if (msg.includes('could not find the table')) return 'Setting up your account... Please try again in a moment.';
    if (msg.includes('relation') && msg.includes('does not exist')) return 'System is initializing. Please try again shortly.';
    if (msg.includes('schema cache')) return 'Connecting to server... Please try again.';

    // Google OAuth 
    if (msg.includes('no tokens received')) return 'Google sign-in was interrupted. Please try again.';
    if (msg.includes('popup')) return 'Sign-in window was blocked. Please allow popups and try again.';

    // Fallback — still show a clean message
    if (msg.length > 100) return 'Something went wrong. Please try again.';
    return rawMessage;
};

// ── Types ──
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
    wfh_days: number | null;
    wfh_period: 'week' | 'month' | null;
    created_at: string;
    updated_at: string;
}

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

// Check if all mandatory profile fields are filled
const checkProfileComplete = (profile: UserProfile | null): boolean => {
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);

    const isProfileComplete = checkProfileComplete(profile);

    // ── Force clear a dead/stale session ──
    const clearStaleSession = async () => {
        console.log('Clearing stale session...');
        try { await supabase.auth.signOut(); } catch (_) {}
        setUser(null);
        setSession(null);
        setProfile(null);
    };

    // ── Fetch Profile with retry (handles race condition with DB trigger) ──
    const fetchProfile = async (userId: string, retryCount = 0) => {
        const MAX_RETRIES = 2;
        const RETRY_DELAY = 1500;

        try {
            setProfileLoading(true);
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) {
                // Auth errors (user deleted from Supabase) → clear stale session
                if (error.message.includes('JWT') || 
                    error.message.includes('token') ||
                    error.code === '401' || 
                    error.code === 'PGRST301') {
                    console.warn('[Auth] Session invalid, clearing...');
                    await clearStaleSession();
                    return;
                }

                // Profile not found yet (DB trigger hasn't created it) → silent retry
                const isNotFound = error.code === 'PGRST116';
                // Table/schema not cached yet → silent retry  
                const isSchemaIssue = error.message.includes('schema cache') || 
                                     error.message.includes('does not exist');
                const isRetryable = isNotFound || isSchemaIssue;
                
                if (isRetryable && retryCount < MAX_RETRIES) {
                    // Silent — this is expected during first sign-up
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    return fetchProfile(userId, retryCount + 1);
                }
                
                // Only log as warning for non-critical, expected cases
                if (isNotFound) {
                    // Profile not created yet — this is normal, proceed with null
                    setProfile(null);
                } else {
                    // Genuine error — log it
                    console.warn('[Profile] Fetch error:', error.message);
                    setProfile(null);
                }
            } else {
                setProfile(data as UserProfile);
            }
        } catch (err: any) {
            // Network errors during profile fetch — silent, app will still flow
            setProfile(null);
        } finally {
            setProfileLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user?.id) {
            await fetchProfile(user.id);
        }
    };

    useEffect(() => {
        // Get initial session AND validate it's still alive
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                    // Validate the session is still valid with a real API call
                    const { data: { user: validUser }, error: userError } = await supabase.auth.getUser();
                    
                    if (userError || !validUser) {
                        // Session is stale — clear silently and go to landing
                        await clearStaleSession();
                        setLoading(false);
                        return;
                    }
                    
                    setSession(session);
                    setUser(validUser);
                    fetchProfile(validUser.id);
                }
            } catch (_err) {
                // Network issue on startup — silently proceed to landing
                // User will see login screen and can retry
            }
            setLoading(false);
        };
        initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── Sign In ──
    const signInWithEmail = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return { error: null };
        } catch (error: any) {
            return { error: new Error(friendlyErrorMessage(error.message || 'Sign in failed')) };
        }
    };

    // ── Sign Up ──
    const signUpWithEmail = async (email: string, password: string, username: string) => {
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
    const signInWithGoogle = async () => {
        try {
            const redirectUrl = makeRedirectUri({
                scheme: 'frontend',
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
                    const url = new URL(result.url);
                    const params = new URLSearchParams(url.hash.substring(1));
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
                    // User cancelled — not an error
                    return { error: null };
                }
            }

            return { error: null };
        } catch (error: any) {
            return { error: new Error(friendlyErrorMessage(error.message || 'Google sign in failed')) };
        }
    };

    // ── OTP Verification ──
    const verifyOtp = async (email: string, token: string) => {
        try {
            const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
            if (error) throw error;
            return { error: null };
        } catch (error: any) {
            return { error: new Error(friendlyErrorMessage(error.message || 'Verification failed')) };
        }
    };

    // ── Resend OTP ──
    const resendOtp = async (email: string) => {
        try {
            const { error } = await supabase.auth.resend({ type: 'signup', email });
            if (error) throw error;
            return { error: null };
        } catch (error: any) {
            return { error: new Error(friendlyErrorMessage(error.message || 'Failed to resend code')) };
        }
    };

    // ── Update Profile ──
    const updateProfile = async (data: Partial<UserProfile>) => {
        if (!user?.id) return { error: new Error('Please sign in to update your profile.') };
        
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({
                    ...data,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);
            
            if (error) throw error;
            
            await fetchProfile(user.id);
            return { error: null };
        } catch (error: any) {
            return { error: new Error(friendlyErrorMessage(error.message || 'Failed to save profile')) };
        }
    };

    // ── Sign Out ──
    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            // Even if signout API fails, clear local state
            console.error('Sign out error:', err);
        }
        setProfile(null);
        setUser(null);
        setSession(null);
        router.replace('/' as any);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                profile,
                loading,
                profileLoading,
                isProfileComplete,
                signInWithEmail,
                signUpWithEmail,
                signInWithGoogle,
                verifyOtp,
                resendOtp,
                updateProfile,
                refreshProfile,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
