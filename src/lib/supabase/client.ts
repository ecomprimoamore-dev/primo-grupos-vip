import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Only public Vite variables belong in the browser bundle.
const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('MY_SUPABASE')
);

// Client-side singleton Supabase instance
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    clientInstance.auth.onAuthStateChange((event, session) => {
      if (typeof window === 'undefined') return;
      if (session?.access_token) window.localStorage.setItem('vip_admin_token', session.access_token);
      if (event === 'SIGNED_OUT') {
        window.localStorage.removeItem('vip_admin_token');
        window.localStorage.removeItem('vip_admin_user');
      }
    });
  }

  return clientInstance;
}
