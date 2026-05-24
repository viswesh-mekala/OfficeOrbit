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
    body?: Record<string, any>,
    options: { injectTimezone?: boolean } = { injectTimezone: true }
): Promise<ApiResponse<T>> {
    try {
        const requestBody = { ...(body || {}) };
        
        if (options.injectTimezone) {
            requestBody.timezoneOffset = new Date().getTimezoneOffset();
        }

        // Force session/token refresh if expired (highly relevant for background tasks)
        await supabase.auth.getSession();

        const { data, error } = await supabase.functions.invoke(functionName, {
            body: Object.keys(requestBody).length > 0 ? requestBody : undefined,
        });

        // Network / Supabase-level error (includes non-2xx from Edge Functions)
        if (error) {
            let detail = error.message || 'API request failed';
            
            // Extract the real error body from FunctionsHttpError
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const errorBody = await error.context.json();
                    detail = errorBody?.error || errorBody?.message || detail;
                }
            } catch (_) {
                // context wasn't readable — use the generic message
            }

            throw new Error(detail);
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
