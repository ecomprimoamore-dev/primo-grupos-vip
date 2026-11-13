import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessEvent, ClickEvent, DashboardMetrics, Store, VipGroup } from '../types';
import { getServerSupabaseClient } from '../lib/supabase/server';

type DbRow = Record<string, any>;

export class RepositoryError extends Error {
  constructor(operation: string) {
    super(`Supabase operation failed: ${operation}`);
    this.name = 'RepositoryError';
  }
}

function fail(operation: string, error: { code?: string; message?: string }): never {
  // Database messages may include query details. Keep logs limited to a safe operation/code.
  console.error(`[repository] ${operation} failed code=${error.code || 'unknown'}`);
  throw new RepositoryError(operation);
}

const mapStore = (row: DbRow): Store => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description || '',
  logoUrl: row.logo_url || '',
  isActive: Boolean(row.is_active),
  distributionMode: row.distribution_mode || 'automatic',
  manualActiveGroupId: row.manual_active_group_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapGroup = (row: DbRow, includePrivateFields = true): VipGroup => ({
  id: includePrivateFields ? row.id || '' : '',
  storeId: row.store_id,
  name: includePrivateFields ? row.name || '' : '',
  inviteUrl: includePrivateFields ? row.invite_url || '' : '',
  clickLimit: row.click_limit,
  currentClicks: row.current_clicks,
  displayOrder: includePrivateFields ? row.display_order : 0,
  isActive: Boolean(row.is_active),
  createdAt: includePrivateFields ? row.created_at : '',
  updatedAt: includePrivateFields ? row.updated_at : '',
});

const mapAccessEvent = (row: DbRow): AccessEvent => ({
  id: row.id,
  storeId: row.store_id,
  visitorHash: row.visitor_hash || '',
  userAgent: row.user_agent || undefined,
  referrer: row.referrer || undefined,
  createdAt: row.created_at,
});

const mapClickEvent = (row: DbRow): ClickEvent => ({
  id: row.id,
  storeId: row.store_id,
  groupId: row.group_id,
  visitorHash: row.visitor_hash || '',
  idempotencyKey: row.idempotency_key || undefined,
  createdAt: row.created_at,
});

export class VipRepository {
  constructor(private readonly client: SupabaseClient, private readonly adminContext = false) {}

  private async listAll<T>(table: string, select: string, operation: string): Promise<T[]> {
    const pageSize = 1000;
    const rows: T[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.client.from(table).select(select).range(from, from + pageSize - 1);
      if (error) fail(operation, error);
      rows.push(...((data || []) as T[]));
      if (!data || data.length < pageSize) return rows;
    }
  }

  async getStores(): Promise<Store[]> {
    const { data, error } = await this.client.from('stores').select('*').order('name');
    if (error) fail('get_stores', error);
    return (data || []).map(mapStore);
  }

  async getStoreBySlug(slug: string): Promise<Store | undefined> {
    const columns = this.adminContext ? '*' : 'id,name,slug,description,logo_url,is_active';
    const { data, error } = await this.client.from('stores').select(columns).eq('slug', slug).maybeSingle();
    if (error) fail('get_store_by_slug', error);
    return data ? mapStore(data) : undefined;
  }

  async getStoreById(id: string): Promise<Store | undefined> {
    const { data, error } = await this.client.from('stores').select('*').eq('id', id).maybeSingle();
    if (error) fail('get_store_by_id', error);
    return data ? mapStore(data) : undefined;
  }

  async createStore(input: {
    name: string; slug: string; description?: string; logoUrl?: string; isActive?: boolean;
    distributionMode?: 'automatic' | 'manual';
  }): Promise<Store> {
    const slug = input.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    const { data, error } = await this.client.from('stores').insert({
      name: input.name.trim(), slug, description: input.description || '', logo_url: input.logoUrl || '',
      is_active: input.isActive ?? true, distribution_mode: input.distributionMode || 'automatic',
    }).select('*').single();
    if (error) fail('create_store', error);

    // Preserve the existing convenience behavior. Roll back the store if its initial group cannot be saved.
    const { error: groupError } = await this.client.from('vip_groups').insert({
      store_id: data.id, name: `Grupo VIP 01 - ${data.name}`,
      invite_url: 'https://chat.whatsapp.com/invite/ExemploVipLink', click_limit: 800,
      current_clicks: 0, display_order: 1, is_active: true,
    });
    if (groupError) {
      await this.client.from('stores').delete().eq('id', data.id);
      fail('create_initial_group', groupError);
    }
    return mapStore(data);
  }

  async updateStore(id: string, updates: Partial<Store>): Promise<Store> {
    const patch: DbRow = {};
    if (updates.name !== undefined) patch.name = updates.name.trim();
    if (updates.slug !== undefined) patch.slug = updates.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    if (updates.description !== undefined) patch.description = updates.description.trim();
    if (updates.logoUrl !== undefined) patch.logo_url = updates.logoUrl.trim();
    if (updates.isActive !== undefined) patch.is_active = Boolean(updates.isActive);
    if (updates.distributionMode !== undefined) patch.distribution_mode = updates.distributionMode;
    if (updates.manualActiveGroupId !== undefined) patch.manual_active_group_id = updates.manualActiveGroupId;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await this.client.from('stores').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) fail('update_store', error);
    if (!data) throw new Error('Loja não encontrada');
    return mapStore(data);
  }

  async deleteStore(id: string): Promise<boolean> {
    const { data, error } = await this.client.from('stores').delete().eq('id', id).select('id');
    if (error) fail('delete_store', error);
    return Boolean(data?.length);
  }

  async getGroupsByStore(storeId: string): Promise<VipGroup[]> {
    const columns = this.adminContext ? '*' : 'store_id,is_active,click_limit,current_clicks';
    let query = this.client.from('vip_groups').select(columns).eq('store_id', storeId);
    if (this.adminContext) query = query.order('display_order').order('created_at');
    const { data, error } = await query;
    if (error) fail('get_groups_by_store', error);
    return (data || []).map((row) => mapGroup(row, this.adminContext));
  }

  async getGroupById(id: string): Promise<VipGroup | undefined> {
    const { data, error } = await this.client.from('vip_groups').select('*').eq('id', id).maybeSingle();
    if (error) fail('get_group_by_id', error);
    return data ? mapGroup(data) : undefined;
  }

  async createGroup(input: {
    storeId: string; name: string; inviteUrl: string; clickLimit?: number; displayOrder?: number; isActive?: boolean;
  }): Promise<VipGroup> {
    const store = await this.getStoreById(input.storeId);
    if (!store) throw new Error('Loja não encontrada');
    const groups = await this.getGroupsByStore(input.storeId);
    const displayOrder = input.displayOrder ?? (groups.length ? Math.max(...groups.map((g) => g.displayOrder)) + 1 : 1);
    const { data, error } = await this.client.from('vip_groups').insert({
      store_id: input.storeId, name: input.name.trim(), invite_url: input.inviteUrl.trim(),
      click_limit: Math.max(1, Number(input.clickLimit) || 800), display_order: displayOrder,
      is_active: input.isActive ?? true,
    }).select('*').single();
    if (error) fail('create_group', error);
    return mapGroup(data);
  }

  async updateGroup(id: string, updates: Partial<VipGroup>): Promise<VipGroup> {
    const patch: DbRow = {};
    if (updates.name !== undefined) patch.name = updates.name.trim();
    if (updates.inviteUrl !== undefined) patch.invite_url = updates.inviteUrl.trim();
    if (updates.clickLimit !== undefined) patch.click_limit = Math.max(1, Number(updates.clickLimit) || 800);
    if (updates.displayOrder !== undefined) patch.display_order = Number(updates.displayOrder);
    if (updates.isActive !== undefined) patch.is_active = Boolean(updates.isActive);
    if (updates.currentClicks !== undefined) patch.current_clicks = Math.max(0, Number(updates.currentClicks));
    patch.updated_at = new Date().toISOString();
    const { data, error } = await this.client.from('vip_groups').update(patch).eq('id', id).select('*').maybeSingle();
    if (error) fail('update_group', error);
    if (!data) throw new Error('Grupo não encontrado');
    return mapGroup(data);
  }

  async deleteGroup(id: string): Promise<boolean> {
    const { data, error } = await this.client.from('vip_groups').delete().eq('id', id).select('id');
    if (error) fail('delete_group', error);
    return Boolean(data?.length);
  }

  async resetGroupClicks(id: string): Promise<VipGroup> {
    const { data, error } = await this.client.from('vip_groups').update({ current_clicks: 0, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').maybeSingle();
    if (error) fail('reset_group_clicks', error);
    if (!data) throw new Error('Grupo não encontrado');
    return mapGroup(data);
  }

  async recordAccess(storeId: string, visitorHash: string, userAgent?: string, referrer?: string): Promise<void> {
    const { error } = await this.client.from('access_events').insert({
      store_id: storeId, visitor_hash: visitorHash, user_agent: userAgent || null, referrer: referrer || null,
    });
    if (error) fail('record_access', error);
  }

  async routeAndIncrementClick(slug: string, idempotencyKey?: string, visitorHash = 'anon') {
    const { data, error } = await this.client.rpc('route_vip_click_atomic', {
      p_store_slug: slug,
      p_idempotency_key: idempotencyKey || null,
      p_visitor_hash: visitorHash,
    });
    if (error) fail('route_vip_click_atomic', error);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Supabase returned no distribution result');
    return {
      success: Boolean(result.success),
      inviteUrl: result.invite_url || undefined,
      groupName: result.group_name || undefined,
      groupId: result.group_id || undefined,
      error: result.error_message || undefined,
    };
  }

  async getDistributionSettings(): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.from('distribution_settings').select('key,value');
    if (error) fail('get_distribution_settings', error);
    return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [stores, groups, accessCount, clickCount, recentResult] = await Promise.all([
      this.getStores(),
      this.listAll<DbRow>('vip_groups', '*', 'get_metrics_groups'),
      this.client.from('access_events').select('id', { count: 'exact', head: true }),
      this.client.from('click_events').select('id', { count: 'exact', head: true }),
      this.client.from('click_events').select('id,store_id,group_id,visitor_hash,created_at,stores(name),vip_groups(name)')
        .order('created_at', { ascending: false }).limit(50),
    ]);
    if (accessCount.error) fail('count_access_events', accessCount.error);
    if (clickCount.error) fail('count_click_events', clickCount.error);
    if (recentResult.error) fail('get_recent_click_events', recentResult.error);

    const accessByStore = await Promise.all(stores.map(async (store) => {
      const { count, error } = await this.client.from('access_events').select('id', { count: 'exact', head: true }).eq('store_id', store.id);
      if (error) fail('count_store_access_events', error);
      return [store.id, count || 0] as const;
    }));
    const clicksByStore = await Promise.all(stores.map(async (store) => {
      const { count, error } = await this.client.from('click_events').select('id', { count: 'exact', head: true }).eq('store_id', store.id);
      if (error) fail('count_store_click_events', error);
      return [store.id, count || 0] as const;
    }));
    const accessMap = new Map(accessByStore);
    const clickMap = new Map(clicksByStore);
    const groupsByStore = new Map<string, VipGroup[]>();
    const mappedGroups = groups.map((row) => mapGroup(row));
    for (const group of mappedGroups) groupsByStore.set(group.storeId, [...(groupsByStore.get(group.storeId) || []), group]);
    const storeById = new Map(stores.map((store) => [store.id, store]));
    const storeMetrics = stores.map((store) => {
      const storeGroups = groupsByStore.get(store.id) || [];
      const totalAccesses = accessMap.get(store.id) || 0;
      const totalClicks = clickMap.get(store.id) || 0;
      const activeGroup = store.distributionMode === 'manual'
        ? storeGroups.find((group) => group.id === store.manualActiveGroupId)
        : storeGroups.find((group) => group.isActive && group.currentClicks < group.clickLimit);
      return {
        storeId: store.id, storeName: store.name, storeSlug: store.slug, isActive: store.isActive,
        totalAccesses, totalClicks,
        conversionRate: totalAccesses ? Number(((totalClicks / totalAccesses) * 100).toFixed(1)) : 0,
        activeGroupName: activeGroup?.name || 'Nenhum ativo', totalGroups: storeGroups.length,
        fullGroups: storeGroups.filter((group) => group.currentClicks >= group.clickLimit).length,
      };
    });
    const groupMetrics = mappedGroups.map((group) => {
      const store = storeById.get(group.storeId);
      const storeGroups = groupsByStore.get(group.storeId) || [];
      const target = store?.distributionMode === 'manual'
        ? store.manualActiveGroupId
        : storeGroups.find((candidate) => candidate.isActive && candidate.currentClicks < candidate.clickLimit)?.id;
      return {
        groupId: group.id, storeId: group.storeId, storeName: store?.name || 'Desconhecida',
        groupName: group.name, inviteUrl: group.inviteUrl, clickLimit: group.clickLimit,
        currentClicks: group.currentClicks, displayOrder: group.displayOrder, isActive: group.isActive,
        isCurrentRoutingTarget: Boolean(store?.isActive && group.isActive && target === group.id),
        percentFull: Math.min(100, Number(((group.currentClicks / group.clickLimit) * 100).toFixed(1))),
      };
    });
    const recentEvents = (recentResult.data || []).map((row: DbRow) => ({
      id: row.id, storeName: row.stores?.name || 'Loja', groupName: row.vip_groups?.name || 'Grupo VIP',
      createdAt: row.created_at, visitorHash: row.visitor_hash || 'anônimo',
    }));
    const totalAccesses = accessCount.count || 0;
    const totalClicks = clickCount.count || 0;
    return {
      totalAccesses, totalClicks,
      conversionRate: totalAccesses ? Number(((totalClicks / totalAccesses) * 100).toFixed(1)) : 0,
      totalStores: stores.length, activeStores: stores.filter((store) => store.isActive).length,
      storeMetrics, groupMetrics, recentEvents,
    };
  }

  async simulateClicks(storeSlug: string, count: number): Promise<{ added: number; lastGroup: string }> {
    let added = 0;
    let lastGroup = '';
    for (let i = 0; i < count; i += 1) {
      const result = await this.routeAndIncrementClick(storeSlug, `simulation-${crypto.randomUUID()}`, 'simulado');
      if (!result.success) break;
      added += 1;
      lastGroup = result.groupName || '';
    }
    return { added, lastGroup };
  }
}

export function createRepository(accessToken?: string): VipRepository {
  const client = getServerSupabaseClient(accessToken);
  if (!client) throw new Error('Supabase is not configured');
  return new VipRepository(client, Boolean(accessToken));
}

export const repository = new Proxy({} as VipRepository, {
  get(_target, property) {
    const instance = createRepository();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
