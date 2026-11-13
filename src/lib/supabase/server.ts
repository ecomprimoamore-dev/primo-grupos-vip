import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  if (typeof process !== 'undefined' && process.env) return process.env[key] || '';
  return '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

export const isServerSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('MY_SUPABASE')
);

let serverClientInstance: SupabaseClient | null = null;

export function getServerSupabaseClient(accessToken?: string): SupabaseClient | null {
  if (!isServerSupabaseConfigured) return null;

  if (accessToken) {
    // Every admin data query carries the already validated user's JWT so PostgreSQL applies RLS.
    return createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  if (!serverClientInstance) {
    serverClientInstance = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return serverClientInstance;
}

/** Validates a Supabase JWT access token on the server. */
export async function verifySupabaseToken(token: string): Promise<{
  valid: boolean;
  user?: { id: string; email?: string; user_metadata?: Record<string, any> };
  status?: number;
  code?: string;
}> {
  const client = getServerSupabaseClient();
  if (!client) return { valid: false, code: 'SUPABASE_NOT_CONFIGURED' };

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return { valid: false, status: error?.status, code: error?.code };
    }

    return {
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
    };
  } catch (error: any) {
    return {
      valid: false,
      status: error?.status,
      code: error?.code || error?.name || 'AUTH_REQUEST_FAILED',
    };
  }
}

export async function getAuthorizedAdmin(token: string) {
  const identity = await verifySupabaseToken(token);
  if (!identity.valid || !identity.user?.id) {
    const isAuthRejection = identity.status !== undefined && identity.status >= 400 && identity.status < 500;
    return isAuthRejection
      ? { status: 'unauthorized' as const, stage: 'auth', upstreamStatus: identity.status, code: identity.code }
      : { status: 'unavailable' as const, stage: 'auth', upstreamStatus: identity.status, code: identity.code };
  }

  // Send the verified user's JWT directly as the PostgREST bearer token.
  // This ensures auth.uid() inside public.is_admin() is the same identity
  // returned by auth.getUser(token); the publishable key is only the API key.
  let adminCheckResponse: Response;
  try {
    adminCheckResponse = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (error: any) {
    return {
      status: 'unavailable' as const,
      stage: 'admins-query',
      upstreamStatus: 503,
      code: error?.code || error?.name || 'RPC_REQUEST_FAILED',
    };
  }

  if (!adminCheckResponse.ok) {
    const errorBody = await adminCheckResponse.json().catch(() => ({}));
    return {
      status: 'unavailable' as const,
      stage: 'admins-query',
      upstreamStatus: adminCheckResponse.status >= 500 ? 503 : 500,
      code: errorBody.code || `HTTP_${adminCheckResponse.status}`,
    };
  }

  const isAdmin: unknown = await adminCheckResponse.json();
  if (isAdmin !== true) {
    return { status: 'forbidden' as const, authUserId: identity.user.id };
  }

  const email = identity.user.email || '';
  const metadata = identity.user.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.display_name || email;
  return {
    status: 'authorized' as const,
    user: { id: identity.user.id, email, name, role: 'admin' },
  };
}
