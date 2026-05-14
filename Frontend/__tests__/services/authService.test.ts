// Use inline jest.fn() in factories (safest for module-level side effects).
// Get mock references after import via jest.mocked() / as jest.Mock cast.

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'officeorbit://auth/callback'),
}));

jest.mock('../../src/services/api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      verifyOtp: jest.fn(),
      resend: jest.fn(),
      signOut: jest.fn(),
      signInWithOAuth: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../src/services/api/supabaseClient';
import {
  signInWithEmail,
  signUpWithEmail,
  verifyOtp,
  resendOtp,
  signOutUser,
  signInWithGoogle,
} from '../../src/services/authService';

// Typed references to the inline mocks
const mockOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockVerifyOtp = supabase.auth.verifyOtp as jest.Mock;
const mockResend = supabase.auth.resend as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockSignInWithOAuth = supabase.auth.signInWithOAuth as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── signInWithEmail ───────────────────────────────────────────────────────────

describe('signInWithEmail', () => {
  test('returns null error on successful sign in', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    const { error } = await signInWithEmail('user@example.com', 'password123');
    expect(error).toBeNull();
  });

  test('calls supabase with correct email and password', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null });

    await signInWithEmail('user@example.com', 'pass');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'pass' });
  });

  test('returns friendly error for invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });

    const { error } = await signInWithEmail('user@example.com', 'wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error!.message).toContain('Incorrect email or password');
  });

  test('returns friendly error for email not confirmed', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Email not confirmed' },
    });

    const { error } = await signInWithEmail('user@example.com', 'pass');
    expect(error?.message).toContain('verify your email');
  });

  test('returns friendly error for network failure', async () => {
    mockSignInWithPassword.mockRejectedValueOnce(new Error('fetch failed'));

    const { error } = await signInWithEmail('user@example.com', 'pass');
    expect(error?.message).toContain('Network error');
  });
});

// ── signUpWithEmail ───────────────────────────────────────────────────────────

describe('signUpWithEmail', () => {
  test('returns null error for successful registration', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'u-1', identities: [{ id: 'i-1' }] }, session: null },
      error: null,
    });

    const { error, needsEmailConfirmation } = await signUpWithEmail('new@user.com', 'password', 'Alice');
    expect(error).toBeNull();
    expect(needsEmailConfirmation).toBe(true);
  });

  test('returns error for already-registered email (empty identities)', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'u-2', identities: [] }, session: null },
      error: null,
    });

    const { error } = await signUpWithEmail('existing@user.com', 'password', 'Bob');
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('already registered');
  });

  test('passes username in user metadata', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'u-3', identities: [{ id: 'i-1' }] }, session: null },
      error: null,
    });

    await signUpWithEmail('test@test.com', 'pass', 'Charlie');
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ data: { name: 'Charlie' } }),
      }),
    );
  });

  test('needsEmailConfirmation is false when session is returned', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'u-4', identities: [{ id: 'i-1' }] }, session: { access_token: 'tok' } },
      error: null,
    });

    const { needsEmailConfirmation } = await signUpWithEmail('auto@confirm.com', 'pass', 'Dave');
    expect(needsEmailConfirmation).toBe(false);
  });

  test('returns error when Supabase throws', async () => {
    mockSignUp.mockResolvedValueOnce({ data: null, error: { message: 'signup is disabled' } });

    const { error } = await signUpWithEmail('x@x.com', 'pass', 'Eve');
    // signUpWithEmail uses raw error.message (no friendlyErrorMessage wrapper)
    expect(error?.message).toContain('signup is disabled');
  });
});

// ── verifyOtp ─────────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  test('returns null error for valid OTP', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: null });

    const { error } = await verifyOtp('user@example.com', '123456');
    expect(error).toBeNull();
  });

  test('calls supabase with correct params', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: null });

    await verifyOtp('user@example.com', '654321');
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'user@example.com', token: '654321', type: 'signup' });
  });

  test('returns friendly error for expired OTP', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: 'Token has expired' } });

    const { error } = await verifyOtp('user@example.com', '000000');
    expect(error?.message).toContain('code has expired');
  });

  test('returns friendly error for invalid OTP', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: 'Invalid OTP provided' } });

    const { error } = await verifyOtp('user@example.com', '111111');
    expect(error?.message).toContain('Invalid verification code');
  });
});

// ── resendOtp ─────────────────────────────────────────────────────────────────

describe('resendOtp', () => {
  test('returns null error on success', async () => {
    mockResend.mockResolvedValueOnce({ error: null });

    const { error } = await resendOtp('user@example.com');
    expect(error).toBeNull();
  });

  test('calls supabase resend with correct type and email', async () => {
    mockResend.mockResolvedValueOnce({ error: null });

    await resendOtp('user@example.com');
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'user@example.com' });
  });

  test('returns error when rate limit exceeded', async () => {
    mockResend.mockResolvedValueOnce({ error: { message: 'email rate limit exceeded' } });

    const { error } = await resendOtp('user@example.com');
    expect(error?.message).toContain('Too many attempts');
  });
});

// ── signOutUser ───────────────────────────────────────────────────────────────

describe('signOutUser', () => {
  test('calls supabase signOut', async () => {
    mockSignOut.mockResolvedValueOnce({});
    await signOutUser();
    expect(mockSignOut).toHaveBeenCalled();
  });

  test('does not throw when signOut throws (silent fail)', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('network error'));
    await expect(signOutUser()).resolves.not.toThrow();
  });
});

// ── signInWithGoogle ──────────────────────────────────────────────────────────

describe('signInWithGoogle', () => {
  test('returns null error when user dismisses browser', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://oauth.example.com' }, error: null });
    mockOpenAuthSession.mockResolvedValueOnce({ type: 'dismiss' });

    const { error } = await signInWithGoogle();
    expect(error).toBeNull();
  });

  test('returns null error when user cancels browser', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://oauth.example.com' }, error: null });
    mockOpenAuthSession.mockResolvedValueOnce({ type: 'cancel' });

    const { error } = await signInWithGoogle();
    expect(error).toBeNull();
  });

  test('calls setSession with tokens on successful OAuth flow', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://oauth.example.com' }, error: null });
    mockOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'officeorbit://auth/callback#access_token=access123&refresh_token=refresh456',
    });
    mockSetSession.mockResolvedValueOnce({});

    const { error } = await signInWithGoogle();
    expect(error).toBeNull();
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access123',
      refresh_token: 'refresh456',
    });
  });

  test('returns error when OAuth URL has no hash fragment', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://oauth.example.com' }, error: null });
    mockOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'officeorbit://auth/callback',
    });

    const { error } = await signInWithGoogle();
    expect(error).toBeInstanceOf(Error);
  });

  test('returns error when tokens are missing from hash', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://oauth.example.com' }, error: null });
    mockOpenAuthSession.mockResolvedValueOnce({
      type: 'success',
      url: 'officeorbit://auth/callback#error=access_denied&error_description=User+denied+access',
    });

    const { error } = await signInWithGoogle();
    expect(error).toBeInstanceOf(Error);
  });

  test('returns error when OAuth itself fails', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: null, error: { message: 'Provider error' } });

    const { error } = await signInWithGoogle();
    expect(error).toBeInstanceOf(Error);
  });
});
