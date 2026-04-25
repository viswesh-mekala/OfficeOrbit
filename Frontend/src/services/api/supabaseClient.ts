import { createClient } from '@supabase/supabase-js';
import { ExpoSecureStoreAdapter } from '../../utils/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Initialize Supabase safely. If environment variables are missing or
// initialization fails (can happen in some EAS/runtime setups), export
// a lightweight stub so the app doesn't crash at module import time.
let supabase: any = null;

const createStubAuth = () => ({
  getSession: async () => ({ data: { session: null } }),
  getUser: async () => ({ data: { user: null } }),
  onAuthStateChange: (_cb: any) => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
  signOut: async () => ({ error: null }),
  signInWithPassword: async () => ({
    error: new Error('Supabase not initialized'),
  }),
  signUp: async () => ({
    data: null,
    error: new Error('Supabase not initialized'),
  }),
  signInWithOAuth: async () => ({
    data: null,
    error: new Error('Supabase not initialized'),
  }),
  setSession: async () => ({ error: new Error('Supabase not initialized') }),
  verifyOtp: async () => ({ error: new Error('Supabase not initialized') }),
  resend: async () => ({ error: new Error('Supabase not initialized') }),
});

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    // Initialization failed in this environment — fall back to stub
    // and log the error for easier debugging in production.
    // eslint-disable-next-line no-console
    console.error('[Supabase] Initialization failed:', err);
    supabase = { auth: createStubAuth() };
  }
} else {
  // Missing env vars — do not crash on import. Log to help diagnosis.
  // eslint-disable-next-line no-console
  console.error(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );
  supabase = { auth: createStubAuth() };
}

export { supabase };
