import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VipRepository } from './repository';

const originalError = console.error;
afterEach(() => { console.error = originalError; });

describe('VipRepository Supabase persistence', () => {
  it('uses only public columns and strips private group fields from anonymous queries', async () => {
    const selections: Array<{ table: string; columns: string }> = [];
    const activeStore = {
      id: 'store-id', name: 'Barigui', slug: 'barigui', description: 'Ofertas', logo_url: '/logo.png', is_active: true,
    };
    const queryFor = (table: string) => {
      const query: any = {
        select: (columns: string) => { selections.push({ table, columns }); return query; },
        eq: () => query,
        maybeSingle: async () => ({ data: activeStore, error: null }),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve({ data: [{ store_id: 'store-id', is_active: true, click_limit: 800, current_clicks: 12, invite_url: 'private-link' }], error: null }).then(resolve, reject),
      };
      return query;
    };
    const client = { from: (table: string) => queryFor(table) };
    const repository = new VipRepository(client as any);
    const store = await repository.getStoreBySlug('barigui');
    const groups = await repository.getGroupsByStore('store-id');
    assert.equal(store?.name, 'Barigui');
    assert.deepEqual(selections, [
      { table: 'stores', columns: 'id,name,slug,description,logo_url,is_active' },
      { table: 'vip_groups', columns: 'store_id,is_active,click_limit,current_clicks' },
    ]);
    assert.equal(groups[0].inviteUrl, '');
    assert.equal(groups[0].name, '');
  });

  it('reads persistent store rows and maps PostgreSQL columns to the API shape', async () => {
    let table = '';
    const query: any = {
      select: () => query,
      order: async () => ({ data: [{
        id: 'store-uuid', name: 'Barigui', slug: 'barigui', description: 'VIP', logo_url: '/logo.png',
        is_active: true, distribution_mode: 'automatic', manual_active_group_id: null,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      }], error: null }),
    };
    const client = { from: (name: string) => { table = name; return query; } };
    const stores = await new VipRepository(client as any).getStores();
    assert.equal(table, 'stores');
    assert.equal(stores[0].logoUrl, '/logo.png');
    assert.equal(stores[0].distributionMode, 'automatic');
    assert.equal(stores[0].manualActiveGroupId, null);
  });

  it('routes public joins through the atomic RPC with the established argument names', async () => {
    let called = false;
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        called = true;
        assert.equal(name, 'route_vip_click_atomic');
        assert.deepEqual(args, {
          p_store_slug: 'barigui', p_idempotency_key: 'request-1', p_visitor_hash: 'visitor-1',
        });
        return { data: [{ success: true, invite_url: 'https://chat.whatsapp.com/example', group_id: 'group-1', group_name: 'VIP 01', error_message: null }], error: null };
      },
    };
    const repository = new VipRepository(client as any);
    const result = await repository.routeAndIncrementClick('barigui', 'request-1', 'visitor-1');
    assert.equal(called, true);
    assert.deepEqual(result, {
      success: true, inviteUrl: 'https://chat.whatsapp.com/example', groupId: 'group-1', groupName: 'VIP 01', error: undefined,
    });
  });

  it('sends concurrent requests independently to PostgreSQL for atomic serialization', async () => {
    const argsSeen: Record<string, unknown>[] = [];
    const client = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        argsSeen.push(args);
        await Promise.resolve();
        return { data: [{ success: true, invite_url: 'https://chat.whatsapp.com/example', group_id: 'group-1', group_name: 'VIP 01' }], error: null };
      },
    };
    const repository = new VipRepository(client as any);
    const results = await Promise.all([
      repository.routeAndIncrementClick('quadrata', 'request-a', 'visitor-a'),
      repository.routeAndIncrementClick('quadrata', 'request-b', 'visitor-b'),
    ]);
    assert.equal(argsSeen.length, 2);
    assert.equal(new Set(argsSeen.map((args) => args.p_idempotency_key)).size, 2);
    assert.ok(results.every((result) => result.success));
  });

  it('does not leak Supabase error details when a database operation fails', async () => {
    let logged = '';
    console.error = (...parts: unknown[]) => { logged = parts.join(' '); };
    const client = {
      rpc: async () => ({ data: null, error: { code: '42501', message: 'sensitive database detail' } }),
    };
    const repository = new VipRepository(client as any);
    await assert.rejects(repository.routeAndIncrementClick('patio'), /Supabase operation failed: route_vip_click_atomic/);
    assert.match(logged, /code=42501/);
    assert.doesNotMatch(logged, /sensitive database detail/);
  });

  it('exports the Express app for Vercel and rewrites the SPA deep links', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { default: app } = await import('../../server');
      assert.equal(typeof app, 'function');
      const routePaths = (app as any)._router.stack
        .flatMap((layer: any) => layer.route ? [layer.route.path] : []);
      assert.ok(routePaths.includes('/api/public/store/:slug'));
      assert.ok(routePaths.includes('/api/admin/verify-admin-session'));
      const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
      assert.equal(config.outputDirectory, 'dist');
      assert.ok(config.rewrites.some((rewrite: any) => rewrite.source === '/vip/:path*' && rewrite.destination === '/index.html'));
      assert.ok(config.rewrites.some((rewrite: any) => rewrite.source === '/admin' && rewrite.destination === '/index.html'));
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
