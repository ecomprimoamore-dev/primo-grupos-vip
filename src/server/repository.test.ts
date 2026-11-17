import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { findNextRoutingGroup, VipRepository } from './repository';
import { orderGroupMetricsForDisplay } from '../components/admin/groupMetricOrdering';
import type { GroupMetricItem, Store, StoreMetricItem, VipGroup } from '../types';

const originalError = console.error;
afterEach(() => { console.error = originalError; });

describe('dashboard routing target selection', () => {
  const store: Store = {
    id: 'store-1', name: 'Barigui', slug: 'barigui', description: '', isActive: true,
    distributionMode: 'automatic', manualActiveGroupId: null, createdAt: '', updatedAt: '',
  };
  const group = (overrides: Partial<VipGroup>): VipGroup => ({
    id: 'group-default', storeId: store.id, name: 'Grupo VIP 01', inviteUrl: '',
    clickLimit: 800, currentClicks: 0, displayOrder: 1, isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '', ...overrides,
  });

  it('matches automatic RPC ordering by display order and creation time', () => {
    const expected = group({ id: 'earlier-in-order', displayOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    const groups = [
      group({ id: 'later-display-order', displayOrder: 2, createdAt: '2025-01-01T00:00:00.000Z' }),
      group({ id: 'later-created', displayOrder: 1, createdAt: '2026-02-01T00:00:00.000Z' }),
      expected,
      group({ id: 'full-earlier', displayOrder: 0, currentClicks: 800 }),
      group({ id: 'inactive-earlier', displayOrder: 0, isActive: false }),
    ];

    assert.equal(findNextRoutingGroup(store, groups)?.id, expected.id);
  });

  it('uses the configured manual group only while active and below its limit', () => {
    const manualStore: Store = { ...store, distributionMode: 'manual', manualActiveGroupId: 'manual-target' };
    const selected = group({ id: 'manual-target', displayOrder: 4 });
    const other = group({ id: 'first-automatic', displayOrder: 1 });

    assert.equal(findNextRoutingGroup(manualStore, [other, selected])?.id, selected.id);
    assert.equal(findNextRoutingGroup(manualStore, [other, { ...selected, currentClicks: selected.clickLimit }]), undefined);
    assert.equal(findNextRoutingGroup(manualStore, [other, { ...selected, isActive: false }]), undefined);
    assert.equal(findNextRoutingGroup({ ...manualStore, isActive: false }, [selected]), undefined);
  });
});

describe('visual ordering of VIP group metrics', () => {
  const stores: StoreMetricItem[] = [
    { storeId: 'patio-id', storeName: 'Pátio Batel', storeSlug: 'patio', isActive: true, totalAccesses: 0, totalClicks: 0, conversionRate: 0, activeGroupName: null, totalGroups: 2, fullGroups: 0 },
    { storeId: 'quadrata-id', storeName: 'Quadrata', storeSlug: 'quadrata', isActive: true, totalAccesses: 0, totalClicks: 0, conversionRate: 0, activeGroupName: null, totalGroups: 2, fullGroups: 0 },
    { storeId: 'barigui-id', storeName: 'Barigui', storeSlug: 'barigui', isActive: true, totalAccesses: 0, totalClicks: 0, conversionRate: 0, activeGroupName: null, totalGroups: 2, fullGroups: 0 },
  ];
  const metric = (storeSlug: string, order: number, active = false): GroupMetricItem => {
    const store = stores.find((item) => item.storeSlug === storeSlug)!;
    return {
      groupId: `${storeSlug}-${order}`, storeId: store.storeId, storeName: store.storeName,
      groupName: `Group ${order}`, inviteUrl: '', clickLimit: 800, currentClicks: 0,
      displayOrder: order, isActive: true, isCurrentRoutingTarget: active, percentFull: 0,
    };
  };

  it('sorts active targets first, then waiting groups by unit and configured order', () => {
    const rows = [
      metric('patio', 2), metric('quadrata', 1, true), metric('barigui', 2),
      metric('patio', 1, true), metric('quadrata', 2), metric('barigui', 1, true),
    ];

    const sorted = orderGroupMetricsForDisplay(rows, stores);

    assert.deepEqual(sorted.map((item) => item.groupId), [
      'barigui-1', 'quadrata-1', 'patio-1', 'barigui-2', 'quadrata-2', 'patio-2',
    ]);
    assert.deepEqual(rows.map((item) => item.groupId), [
      'patio-2', 'quadrata-1', 'barigui-2', 'patio-1', 'quadrata-2', 'barigui-1',
    ]);
  });

  it('moves a newly active group into the active category on the next sort', () => {
    const rows = [metric('barigui', 1, true), metric('patio', 1)];
    const updatedRows = rows.map((item) => ({
      ...item,
      isCurrentRoutingTarget: item.storeId === 'patio-id',
    }));

    assert.equal(orderGroupMetricsForDisplay(updatedRows, stores)[0].groupId, 'patio-1');
  });
});

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
      const { createApp } = await import('../../server');
      const app = await createApp();
      const { default: vercelHandler } = await import('./vercel-handler');
      assert.equal(typeof app, 'function');
      assert.equal(typeof vercelHandler, 'function');
      const routePaths = (app as any)._router.stack
        .flatMap((layer: any) => layer.route ? [layer.route.path] : []);
      assert.ok(routePaths.includes('/api/public/store/:slug'));
      assert.ok(routePaths.includes('/api/admin/verify-admin-session'));
      const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
      assert.equal(config.outputDirectory, 'dist');
      assert.deepEqual(config.rewrites[0], {
        source: '/api/:path*', destination: '/api/express?__path=:path*',
      });
      assert.ok(config.rewrites.some((rewrite: any) => rewrite.source === '/vip/:path*' && rewrite.destination === '/index.html'));
      assert.ok(config.rewrites.some((rewrite: any) => rewrite.source === '/admin' && rewrite.destination === '/index.html'));

      const serverlessBundle = readFileSync(resolve(process.cwd(), 'api/express.js'), 'utf8');
      assert.doesNotMatch(serverlessBundle, /from ['"]\.\.\/server['"]/);
      assert.match(serverlessBundle, /createApp/);

      const server = createServer(vercelHandler);
      await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
      try {
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const response = await fetch(`http://127.0.0.1:${address.port}/api/express?__path=admin/verify-admin-session`, { method: 'POST' });
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: 'Authentication required.' });
      } finally {
        await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
      }
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
