import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Secure storage adapter with chunking for large Supabase tokens (>2048 bytes)
const CHUNK_SIZE = 1800; // Stay well under SecureStore's 2048 limit

const ExpoSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        const value = await SecureStore.getItemAsync(key);
        // If not chunked, return directly
        if (value !== '__CHUNKED__') return value;

        // Reassemble chunks
        let result = '';
        let i = 0;
        while (true) {
            const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
            if (chunk === null) break;
            result += chunk;
            i++;
        }
        return result || null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (value.length <= CHUNK_SIZE) {
            await SecureStore.setItemAsync(key, value);
            return;
        }

        // Split into chunks
        await SecureStore.setItemAsync(key, '__CHUNKED__');
        const chunks = Math.ceil(value.length / CHUNK_SIZE);
        for (let i = 0; i < chunks; i++) {
            await SecureStore.setItemAsync(
                `${key}_chunk_${i}`,
                value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
            );
        }
    },
    removeItem: async (key: string): Promise<void> => {
        const value = await SecureStore.getItemAsync(key);
        await SecureStore.deleteItemAsync(key);

        // Clean up chunks if they exist
        if (value === '__CHUNKED__') {
            let i = 0;
            while (true) {
                const chunkKey = `${key}_chunk_${i}`;
                const chunk = await SecureStore.getItemAsync(chunkKey);
                if (chunk === null) break;
                await SecureStore.deleteItemAsync(chunkKey);
                i++;
            }
        }
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
