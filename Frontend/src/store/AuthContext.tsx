import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';



// Types
import { UserProfile, UserEntitlement, AuthContextType } from '../types/auth.types';

// Services (all DB calls are delegated here)
import * as authService from '../services/authService';
import { fetchUserProfile, updateUserProfile, checkProfileComplete } from '../services/profileService';
import * as entitlementsService from '../services/billing/EntitlementsService';

/**
 * AuthContext — pure state management layer.
 * All Supabase/DB calls are delegated to services.
 * This file only manages React state and coordinates between services.
 */

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [entitlement, setEntitlement] = useState<UserEntitlement | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);
    const [entitlementLoading, setEntitlementLoading] = useState(false);

    const isProfileComplete = checkProfileComplete(profile);

    // ── Clear stale session (local state + service) ──
    const clearStaleSession = async () => {
        await authService.forceSignOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setEntitlement(null);
        await entitlementsService.clearCachedEntitlement();
    };

    // ── Fetch profile (delegates to service, updates state) ──
    const fetchProfile = async (userId: string) => {
        setProfileLoading(true);
        try {
            const result = await fetchUserProfile(userId);

            if (result.shouldClearSession) {
                await clearStaleSession();
            } else {
                setProfile(result.data);
            }
        } finally {
            setProfileLoading(false);
        }
    };

    const refreshProfile = async () => {
        if (user?.id) {
            await fetchProfile(user.id);
        }
    };

    // ── Fetch fresh entitlements ──
    const refreshEntitlements = async () => {
        if (!user?.id) return;
        setEntitlementLoading(true);
        try {
            const { data } = await entitlementsService.fetchUserEntitlement();
            if (data) {
                setEntitlement(data);
            }
        } finally {
            setEntitlementLoading(false);
        }
    };

    // Trigger background entitlements fetch when user loads
    useEffect(() => {
        if (user?.id) {
            void refreshEntitlements();
        }
    }, [user?.id]);

    // ── Initialize session on mount ──
    useEffect(() => {
        const initSession = async () => {
            try {
                // Try to load cached entitlement first for instant UI response
                const cachedEnt = await entitlementsService.getCachedEntitlement();
                if (cachedEnt) {
                    setEntitlement(cachedEnt);
                }

                const { data: { session } } = await authService.getSession();

                if (session) {
                    const { data: { user: validUser }, error: userError } = await authService.getUser();

                    if (userError || !validUser) {
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
            }
            setLoading(false);
        };
        initSession();

        // Listen for auth changes
        const { data: { subscription } } = authService.onAuthStateChange((_event: string, session: any) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                void fetchProfile(session.user.id); // void: intentionally unawaited in sync callback
            } else {
                setProfile(null);
                setEntitlement(null);
                void entitlementsService.clearCachedEntitlement();
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── Auth methods (delegate to service, return result) ──
    const signInWithEmail = async (email: string, password: string) => {
        return authService.signInWithEmail(email, password);
    };

    const signUpWithEmail = async (email: string, password: string, username: string) => {
        return authService.signUpWithEmail(email, password, username);
    };

    const signInWithGoogle = async () => {
        return authService.signInWithGoogle();
    };

    const verifyOtp = async (email: string, token: string) => {
        return authService.verifyOtp(email, token);
    };

    const resendOtp = async (email: string) => {
        return authService.resendOtp(email);
    };

    const updateProfile = async (data: Partial<UserProfile>) => {
        if (!user?.id) return { error: new Error('Please sign in to update your profile.') };

        const result = await updateUserProfile(user.id, data);
        if (!result.error) {
            await fetchProfile(user.id);
        }
        return result;
    };

    const signOut = async () => {
        await authService.signOutUser();
        setProfile(null);
        setEntitlement(null);
        setUser(null);
        setSession(null);
        await entitlementsService.clearCachedEntitlement();
        // Navigation handled by _layout.tsx auth effect (single source of truth)
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                profile,
                entitlement,
                loading,
                profileLoading,
                entitlementLoading,
                isProfileComplete,
                signInWithEmail,
                signUpWithEmail,
                signInWithGoogle,
                verifyOtp,
                resendOtp,
                updateProfile,
                refreshProfile,
                refreshEntitlements,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
