import { Redirect } from 'expo-router';

// This route catches the OAuth callback redirect from Supabase
// It immediately redirects to the auth-callback screen for processing
export default function AuthCallbackRoute() {
    return <Redirect href="/auth-callback" />;
}
