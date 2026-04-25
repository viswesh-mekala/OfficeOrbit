import { supabase } from './supabaseClient';
import { friendlyErrorMessage } from '../../utils/errorHandler';

/**
 * Generic API client for calling Supabase Edge Functions.
 * 
 * - Automatically injects `timezoneOffset` into every request body.
 * - Unwraps the nested response from `supabase.functions.invoke()`.
 * - Applies user-friendly error messages.
 * 
 * All backend communication (except auth) should go through this function.
 */

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    message?: string;
}

export async function callApi<T = any>(
    functionName: string,
    body?: Record<string, any>
): Promise<ApiResponse<T>> {
    try {
        const requestBody = {
            ...(body || {}),
            timezoneOffset: new Date().getTimezoneOffset(),
        };

        const { data, error } = await supabase.functions.invoke(functionName, {
            body: requestBody,
        });

        // Network / Supabase-level error
        if (error) {
            throw new Error(error.message || 'API request failed');
        }

        // Edge Function returned an error in the response body
        if (data && data.success === false) {
            throw new Error(data.error || 'Request failed');
        }

        return {
            data: data?.data ?? null,
            error: null,
            message: data?.message,
        };
    } catch (err: any) {
        return {
            data: null,
            error: friendlyErrorMessage(err.message || 'Something went wrong'),
        };
    }
}
