import { friendlyErrorMessage } from '../../src/utils/errorHandler';

describe('friendlyErrorMessage', () => {
  // ── Auth errors ──────────────────────────────────────────────────────────────
  test('maps invalid login credentials', () => {
    expect(friendlyErrorMessage('Invalid login credentials')).toBe(
      'Incorrect email or password. Please try again.',
    );
  });

  test('maps email not confirmed error', () => {
    expect(friendlyErrorMessage('Email not confirmed')).toBe(
      'Please verify your email address first.',
    );
  });

  test('maps user already registered', () => {
    expect(friendlyErrorMessage('user already registered')).toBe(
      'This email is already registered. Try signing in.',
    );
  });

  test('maps invalid email', () => {
    expect(friendlyErrorMessage('invalid email format')).toBe(
      'Please enter a valid email address.',
    );
  });

  test('maps password too short (contains password + 6)', () => {
    expect(friendlyErrorMessage('password should be at least 6 characters')).toBe(
      'Password must be at least 6 characters.',
    );
  });

  test('maps signup is disabled', () => {
    expect(friendlyErrorMessage('Signup is disabled')).toBe(
      'Sign up is temporarily disabled. Please try again later.',
    );
  });

  test('maps email rate limit', () => {
    expect(friendlyErrorMessage('email rate limit exceeded')).toBe(
      'Too many attempts. Please wait a few minutes.',
    );
  });

  test('maps rate limit (generic)', () => {
    expect(friendlyErrorMessage('rate limit reached')).toBe(
      'Too many requests. Please wait and try again.',
    );
  });

  // ── OTP errors ───────────────────────────────────────────────────────────────
  test('maps token has expired', () => {
    expect(friendlyErrorMessage('Token has expired')).toBe(
      'This code has expired. Please request a new one.',
    );
  });

  test('maps otp has expired', () => {
    expect(friendlyErrorMessage('OTP has expired')).toBe(
      'This code has expired. Please request a new one.',
    );
  });

  test('maps invalid OTP', () => {
    expect(friendlyErrorMessage('Invalid OTP provided')).toBe(
      'Invalid verification code. Please check and try again.',
    );
  });

  test('maps invalid token', () => {
    expect(friendlyErrorMessage('invalid token received')).toBe(
      'Invalid verification code. Please check and try again.',
    );
  });

  // ── Network errors ───────────────────────────────────────────────────────────
  test('maps network error', () => {
    expect(friendlyErrorMessage('network request failed')).toBe(
      'Network error. Please check your connection and try again.',
    );
  });

  test('maps timeout', () => {
    expect(friendlyErrorMessage('Request timeout exceeded')).toBe(
      'Network error. Please check your connection and try again.',
    );
  });

  test('maps failed to fetch', () => {
    expect(friendlyErrorMessage('Failed to fetch data')).toBe(
      'Network error. Please check your connection and try again.',
    );
  });

  // ── Database errors ──────────────────────────────────────────────────────────
  test('maps profile not found', () => {
    expect(friendlyErrorMessage('Profile not found in database')).toBe(
      'Please finish setting up your profile before continuing.',
    );
  });

  // ── Attendance errors ─────────────────────────────────────────────────────────
  test('passes through "too far from office" verbatim', () => {
    const msg = 'You are too far from office (850m). Try marking WFH instead.';
    expect(friendlyErrorMessage(msg)).toBe(msg);
  });

  test('maps no active check-in found', () => {
    expect(friendlyErrorMessage('No active check-in found')).toBe(
      'You have not checked in yet today.',
    );
  });

  test('maps invalid location data', () => {
    expect(friendlyErrorMessage('invalid location data provided')).toBe(
      'We could not read your location. Please try again.',
    );
  });

  // ── Team errors ───────────────────────────────────────────────────────────────
  test('maps invalid team code', () => {
    expect(friendlyErrorMessage('Invalid team code provided')).toBe(
      'That team code does not match any team. Please check it and try again.',
    );
  });

  test('maps already in a team', () => {
    expect(friendlyErrorMessage('User is already in a team')).toBe(
      'You are already in a team. Leave your current team before joining another.',
    );
  });

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  test('maps no tokens received', () => {
    expect(friendlyErrorMessage('No tokens received from OAuth')).toBe(
      'Google sign-in was interrupted. Please try again.',
    );
  });

  // ── Fallback ─────────────────────────────────────────────────────────────────
  test('returns message verbatim for short unknown error', () => {
    expect(friendlyErrorMessage('Something weird happened')).toBe('Something weird happened');
  });

  test('truncates and replaces very long unknown messages', () => {
    const longMsg = 'x'.repeat(101);
    expect(friendlyErrorMessage(longMsg)).toBe('Something went wrong. Please try again.');
  });

  test('supabase not initialized maps to reinstall message', () => {
    expect(friendlyErrorMessage('supabase not initialized in this build')).toBe(
      'App setup is incomplete. Please reinstall or use the latest build.',
    );
  });

  test('unauthorized maps to session expired', () => {
    expect(friendlyErrorMessage('Unauthorized request')).toBe(
      'Your session has expired. Please sign in again.',
    );
  });
});
