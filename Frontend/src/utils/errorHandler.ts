/**
 * Maps raw Supabase/API errors to user-friendly messages.
 * Covers auth, OTP, network, database, and OAuth error categories.
 */
export const friendlyErrorMessage = (rawMessage: string): string => {
    const msg = rawMessage.toLowerCase();

    if (msg.includes('supabase not initialized')) return 'App setup is incomplete. Please reinstall or use the latest build.';
    if (msg.includes('unauthorized')) return 'Your session has expired. Please sign in again.';

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
    if (msg.includes('load that office location')) return 'We could not load that office location. Please try another suggestion.';
    
    // Database
    if (msg.includes('could not find the table')) return 'Setting up your account... Please try again in a moment.';
    if (msg.includes('relation') && msg.includes('does not exist')) return 'System is initializing. Please try again shortly.';
    if (msg.includes('schema cache')) return 'Connecting to server... Please try again.';
    if (msg.includes('profile not found')) return 'Please finish setting up your profile before continuing.';

    // Attendance
    if (msg.includes('too far from office')) return rawMessage;
    if (msg.includes('no active check-in found')) return 'You have not checked in yet today.';
    if (msg.includes('invalid location data')) return 'We could not read your location. Please try again.';

    // Team
    if (msg.includes('invalid team code')) return 'That team code does not match any team. Please check it and try again.';
    if (msg.includes('already in a team')) return 'You are already in a team. Leave your current team before joining another.';
    if (msg.includes('team name is required')) return 'Please enter a team name.';
    if (msg.includes('team code is required')) return 'Please enter a team code.';
    if (msg.includes('unable to generate a unique team code')) return 'We could not create a team code right now. Please try again.';

    // Google OAuth 
    if (msg.includes('no tokens received')) return 'Google sign-in was interrupted. Please try again.';
    if (msg.includes('popup')) return 'Sign-in window was blocked. Please allow popups and try again.';
    if (msg.includes('google sign-in could not be started')) return 'Google sign-in could not be started. Please try again.';

    // Fallback
    if (msg.length > 100) return 'Something went wrong. Please try again.';
    return rawMessage;
};
