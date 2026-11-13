import { Store, VipGroup, DashboardMetrics } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/client';

const ADMIN_TOKEN_KEY = 'vip_admin_token';
const ADMIN_USER_KEY = 'vip_admin_user';

export const authStorage = {
  getToken: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  getUser: () => {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user: any) => localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  },
};

const getHeaders = (includeAuth = false): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (includeAuth) {
    const token = authStorage.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
};

export const api = {
  // Public
  async getStorePublic(slug: string, track = true) {
    const res = await fetch(`/api/public/store/${encodeURIComponent(slug)}?track=${track ? '1' : '0'}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Loja não encontrada');
    }
    return res.json() as Promise<{
      id: string;
      name: string;
      slug: string;
      description: string;
      logoUrl?: string;
      isActive: boolean;
      hasAvailableGroups: boolean;
    }>;
  },

  async joinVipGroup(slug: string, idempotencyKey: string) {
    const res = await fetch(`/api/public/store/${encodeURIComponent(slug)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível acessar o grupo no momento.');
    }
    return data as { success: boolean; inviteUrl: string; groupName: string };
  },

  // Admin Auth via Supabase Auth & Server Authorization
  async login(email: string, pass: string) {
    const trimmedEmail = email.trim();

    // 1. If Supabase is configured in environment, authenticate via Supabase Auth
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Falha ao inicializar o cliente Supabase.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: pass,
      });

      if (error || !data.session) {
        if (error?.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
        }
        if (error?.message?.toLowerCase().includes('failed to fetch')) {
          throw new Error('Falha de conexão com o Supabase. Verifique sua conexão ou configurações de rede.');
        }
        throw new Error(error?.message || 'Falha ao autenticar no Supabase Auth.');
      }

      const accessToken = data.session.access_token;

      // 2. Validate user identity and administrative authorization on the server
      let verifyRes: Response;
      try {
        verifyRes = await fetch('/api/admin/verify-admin-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ token: accessToken }),
        });
      } catch {
        await supabase.auth.signOut();
        authStorage.clear();
        throw new Error('Falha de rede ao conectar com o servidor do painel. Verifique se o Express está acessível.');
      }

      const verifyData = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok || !verifyData.authorized) {
        // Sign out from Supabase because user is not authorized as an admin
        await supabase.auth.signOut();
        authStorage.clear();
        const statusMessage = verifyRes.status === 401
          ? 'Sessão inválida ou expirada. Entre novamente.'
          : verifyRes.status === 403
            ? 'Esta conta não está autorizada como administradora. Verifique se o usuário do Supabase está vinculado em public.admins via auth_user_id e se a função public.is_admin() foi aplicada corretamente.'
            : verifyRes.status === 404
              ? 'A rota de validação administrativa não foi encontrada no Express.'
              : verifyRes.status >= 500
                ? 'O servidor não conseguiu validar o acesso administrativo no Supabase.'
                : `A API administrativa respondeu com HTTP ${verifyRes.status}.`;
        throw new Error(
          `${statusMessage} (${verifyRes.status})${verifyData.error ? ` ${verifyData.error}` : ''}`
        );
      }

      authStorage.setToken(accessToken);
      authStorage.setUser(verifyData.user);

      return {
        token: accessToken,
        user: verifyData.user,
      };
    }

    throw new Error('Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  },

  async logout() {
    try {
      if (isSupabaseConfigured) {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.auth.signOut();
        }
      }
    } catch (err) {
      console.warn('Erro ao finalizar sessão Supabase:', err);
    } finally {
      authStorage.clear();
    }
  },

  async checkCurrentSession(): Promise<{ authenticated: boolean; user?: any }> {
    try {
      if (!isSupabaseConfigured) return { authenticated: false };
      const supabase = getSupabaseClient();
      if (!supabase) return { authenticated: false };
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { authStorage.clear(); return { authenticated: false }; }
      authStorage.setToken(token);

      const res = await fetch('/api/admin/verify-admin-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        authStorage.clear();
        return { authenticated: false };
      }

      const result = await res.json();
      if (!result.authorized) {
        authStorage.clear();
        return { authenticated: false };
      }
      authStorage.setUser(result.user);
      return { authenticated: true, user: result.user };
    } catch {
      // Network failure or offline
      authStorage.clear();
      return { authenticated: false };
    }
  },

  // Admin Stores
  async getStores() {
    const res = await fetch('/api/admin/stores', {
      headers: getHeaders(true),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        authStorage.clear();
        throw new Error('Sessão expirada ou não autorizada');
      }
      throw new Error('Falha ao carregar lojas');
    }
    return res.json() as Promise<Store[]>;
  },

  async createStore(payload: Partial<Store>) {
    const res = await fetch('/api/admin/stores', {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao criar loja');
    return data as Store;
  },

  async updateStore(id: string, payload: Partial<Store>) {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao atualizar loja');
    return data as Store;
  },

  async deleteStore(id: string) {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(true),
    });
    if (!res.ok) throw new Error('Falha ao excluir loja');
    return res.json();
  },

  // Admin Groups
  async getGroups(storeId: string) {
    const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/groups`, {
      headers: getHeaders(true),
    });
    if (!res.ok) throw new Error('Falha ao carregar grupos da loja');
    return res.json() as Promise<VipGroup[]>;
  },

  async createGroup(payload: Partial<VipGroup>) {
    const res = await fetch('/api/admin/groups', {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao cadastrar grupo');
    return data as VipGroup;
  },

  async updateGroup(id: string, payload: Partial<VipGroup>) {
    const res = await fetch(`/api/admin/groups/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao atualizar grupo');
    return data as VipGroup;
  },

  async deleteGroup(id: string) {
    const res = await fetch(`/api/admin/groups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(true),
    });
    if (!res.ok) throw new Error('Falha ao excluir grupo');
    return res.json();
  },

  async resetGroupClicks(id: string) {
    const res = await fetch(`/api/admin/groups/${encodeURIComponent(id)}/reset-clicks`, {
      method: 'POST',
      headers: getHeaders(true),
    });
    if (!res.ok) throw new Error('Falha ao zerar cliques');
    return res.json() as Promise<VipGroup>;
  },

  // Admin Metrics
  async getMetrics() {
    const res = await fetch('/api/admin/metrics', {
      headers: getHeaders(true),
    });
    if (!res.ok) throw new Error('Falha ao carregar métricas');
    return res.json() as Promise<DashboardMetrics>;
  },

  // Simulate Traffic
  async simulateClicks(storeSlug: string, count: number) {
    const res = await fetch('/api/admin/simulate', {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ storeSlug, count }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na simulação');
    return data;
  },
};
