import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import { createRepository, repository, RepositoryError } from './src/server/repository';
import { getAuthorizedAdmin, isServerSupabaseConfigured } from './src/lib/supabase/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryErrorStatus = (error: unknown, fallback: number) =>
  error instanceof RepositoryError ? 503 : fallback;

export async function createApp() {
  const app = express();

  app.use(express.json());

  // Validate the Supabase identity and admin allowlist for every protected API call.
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !header.slice(7).trim()) {
      console.info(`[admin-auth] ${req.method} ${req.path} status=401 reason=missing_bearer`);
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!isServerSupabaseConfigured) {
      console.error(`[admin-auth] ${req.method} ${req.path} status=503 reason=supabase_not_configured`);
      res.status(503).json({ error: 'Supabase is not configured.' });
      return;
    }
    try {
      const result = await getAuthorizedAdmin(header.slice(7).trim());
      if (result.status === 'unauthorized') {
        console.info(`[admin-auth] ${req.method} ${req.path} status=401 reason=invalid_session`);
        res.status(401).json({ error: 'Session invalid or expired.' });
        return;
      }
      if (result.status === 'forbidden') {
        console.info(`[admin-auth] ${req.method} ${req.path} status=403 reason=not_admin auth_user_id=${result.authUserId}`);
        res.status(403).json({ error: 'Administrator access required.' });
        return;
      }
      if (result.status !== 'authorized') {
        const status = result.upstreamStatus === 500 ? 500 : 503;
        console.error(`[admin-auth] ${req.method} ${req.path} status=${status} stage=${result.stage} code=${result.code || 'unknown'}`);
        res.status(status).json({ error: 'Unable to check administrator access.' });
        return;
      }
      (req as any).adminUser = result.user;
      (req as any).repository = createRepository(header.slice(7).trim());
      next();
    } catch (error: any) {
      const code = error?.code || error?.name || 'unknown';
      console.error(`[admin-auth] ${req.method} ${req.path} status=503 stage=unexpected code=${code}`);
      res.status(503).json({ error: 'Unable to validate Supabase session.' });
    }
  };

  // ==========================================
  // PUBLIC ROUTES (PÁGINA PÚBLICA DE CAPTAÇÃO)
  // ==========================================

  // Obter dados da loja pelo slug e registrar acesso
  app.get('/api/public/store/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const store = await repository.getStoreBySlug(slug);

      if (!store) {
        res.status(404).json({ error: 'Loja não encontrada.' });
        return;
      }

      // Registro do evento de acesso à página
      const visitorHash = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'visitor';
      const userAgent = req.headers['user-agent'];
      const referrer = req.headers['referer'];

      if (req.query.track !== '0') {
        await repository.recordAccess(store.id, visitorHash, userAgent, referrer);
      }

      const groups = await repository.getGroupsByStore(store.id);
      const hasActiveGroups = groups.some((g) => g.isActive && g.currentClicks < g.clickLimit);

      res.json({
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: store.description,
        logoUrl: store.logoUrl,
        isActive: store.isActive,
        hasAvailableGroups: hasActiveGroups,
      });
    } catch (err: any) {
      console.error('Erro em /api/public/store/:slug:', err);
      res.status(repositoryErrorStatus(err, 500)).json({ error: 'Erro interno ao consultar loja.' });
    }
  });

  // Entrar no grupo VIP: Seleção atômica com trava de concorrência e incremento
  app.post('/api/public/store/:slug/join', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const { idempotencyKey, visitorHash } = req.body || {};

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'client';
      const hash = visitorHash || `ip-${ip.substring(0, 16)}`;

      const result = await repository.routeAndIncrementClick(slug, idempotencyKey, hash);

      if (!result.success) {
        res.status(400).json({
          error: result.error || 'Não foi possível encontrar um grupo disponível no momento.',
        });
        return;
      }

      res.json({
        success: true,
        inviteUrl: result.inviteUrl,
        groupName: result.groupName,
        message: 'Redirecionando para o WhatsApp...',
      });
    } catch (err: any) {
      console.error('Erro em /api/public/store/:slug/join:', err);
      res.status(repositoryErrorStatus(err, 500)).json({ error: 'Erro interno no direcionamento atômico.' });
    }
  });

  // ==========================================
  // ADMIN AUTH ROUTES
  // ==========================================

  app.get('/api/admin/me', requireAdmin, (req: Request, res: Response) => { res.json({ status: 'authenticated', user: (req as any).adminUser }); });

  // Explicit session verification endpoint for Supabase Auth and token verification
  app.post('/api/admin/verify-admin-session', requireAdmin, (req: Request, res: Response) => { res.json({ authorized: true, user: (req as any).adminUser }); });

  // ==========================================
  // ADMIN STORE MANAGEMENT
  // ==========================================

  app.get('/api/admin/stores', requireAdmin, async (req: Request, res: Response) => {
    try {
      res.json(await (req as any).repository.getStores());
    } catch {
      res.status(503).json({ error: 'Não foi possível consultar as unidades.' });
    }
  });

  app.post('/api/admin/stores', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, slug, description, logoUrl, isActive, distributionMode } = req.body;
      if (!name || !slug) {
        res.status(400).json({ error: 'Nome da loja e slug são obrigatórios.' });
        return;
      }

      const store = await (req as any).repository.createStore({
        name,
        slug,
        description,
        logoUrl,
        isActive,
        distributionMode,
      });

      res.status(201).json(store);
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? 'Não foi possível salvar a unidade.' : err.message || 'Erro ao criar loja.' });
    }
  });

  app.put('/api/admin/stores/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await (req as any).repository.updateStore(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? 'Não foi possível atualizar a unidade.' : err.message || 'Erro ao atualizar loja.' });
    }
  });

  app.delete('/api/admin/stores/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await (req as any).repository.deleteStore(id);
      if (!success) {
        res.status(404).json({ error: 'Loja não encontrada.' });
        return;
      }
      res.json({ success: true, message: 'Loja removida com sucesso.' });
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 500)).json({ error: 'Erro ao remover loja.' });
    }
  });

  // ==========================================
  // ADMIN GROUP MANAGEMENT
  // ==========================================

  app.get('/api/admin/stores/:storeId/groups', requireAdmin, async (req: Request, res: Response) => {
    const { storeId } = req.params;
    try {
      res.json(await (req as any).repository.getGroupsByStore(storeId));
    } catch {
      res.status(503).json({ error: 'Não foi possível consultar os grupos.' });
    }
  });

  app.post('/api/admin/groups', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { storeId, name, inviteUrl, clickLimit, displayOrder, isActive } = req.body;
      if (!storeId || !name || !inviteUrl) {
        res.status(400).json({ error: 'Loja, nome do grupo e link de convite são obrigatórios.' });
        return;
      }

      const group = await (req as any).repository.createGroup({
        storeId,
        name,
        inviteUrl,
        clickLimit,
        displayOrder,
        isActive,
      });

      res.status(201).json(group);
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? 'Não foi possível cadastrar o grupo.' : err.message || 'Erro ao cadastrar grupo.' });
    }
  });

  app.put('/api/admin/groups/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const group = await (req as any).repository.updateGroup(id, req.body);
      res.json(group);
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? 'Não foi possível atualizar o grupo.' : err.message || 'Erro ao atualizar grupo.' });
    }
  });

  app.delete('/api/admin/groups/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = await (req as any).repository.deleteGroup(id);
      if (!success) {
        res.status(404).json({ error: 'Grupo não encontrado.' });
        return;
      }
      res.json({ success: true, message: 'Grupo removido com sucesso.' });
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 500)).json({ error: 'Erro ao remover grupo.' });
    }
  });

  app.post('/api/admin/groups/:id/reset-clicks', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const group = await (req as any).repository.resetGroupClicks(id);
      res.json(group);
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? 'Não foi possível zerar os cliques.' : err.message || 'Erro ao zerar cliques do grupo.' });
    }
  });

  // ==========================================
  // ADMIN REPORTS & METRICS
  // ==========================================

  app.get('/api/admin/metrics', requireAdmin, async (req: Request, res: Response) => {
    try {
      const metrics = await (req as any).repository.getDashboardMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 500)).json({ error: 'Erro ao calcular relatórios.' });
    }
  });

  // Simular cliques para teste da distribuição automática
  app.post('/api/admin/simulate', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { storeSlug, count } = req.body;
      const num = Math.min(1000, Math.max(1, Number(count) || 10));
      const result = await (req as any).repository.simulateClicks(storeSlug, num);
      res.json({
        success: true,
        message: `Simulados ${result.added} cliques na loja ${storeSlug}.`,
        lastGroup: result.lastGroup,
      });
    } catch (err: any) {
      res.status(repositoryErrorStatus(err, 400)).json({ error: err instanceof RepositoryError ? 'Não foi possível simular a distribuição.' : err.message || 'Erro na simulação.' });
    }
  });

  // ==========================================
  // PERMANENT QR CODES (PNG and SVG)
  // ==========================================

  app.get('/api/admin/qrcode/:slug', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const format = req.query.format === 'svg' ? 'svg' : 'png';
      const download = req.query.download === '1';

      // Permanent target URL pointing to public store VIP landing page
      const deploymentUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        (process.env.VERCEL_ENV === 'preview' ? process.env.VERCEL_URL : '');
      const configuredUrl = process.env.APP_URL || (deploymentUrl ? `https://${deploymentUrl}` : '');
      const fallbackUrl = process.env.NODE_ENV === 'production'
        ? ''
        : `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
      const rawAppUrl = configuredUrl || fallbackUrl;
      const appUrl = (/^https?:\/\//i.test(rawAppUrl) ? rawAppUrl : `https://${rawAppUrl}`).replace(/\/$/, '');
      if (!appUrl || (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(appUrl))) {
        res.status(503).json({ error: 'A URL pública do sistema não está configurada.' });
        return;
      }
      const targetUrl = `${appUrl}/vip/${slug}`;

      if (format === 'svg') {
        const svgString = await QRCode.toString(targetUrl, {
          type: 'svg',
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });

        res.setHeader('Content-Type', 'image/svg+xml');
        if (download) {
          res.setHeader('Content-Disposition', `attachment; filename="qrcode-vip-${slug}.svg"`);
        }
        res.send(svgString);
      } else {
        const buffer = await QRCode.toBuffer(targetUrl, {
          type: 'png',
          width: 800,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });

        res.setHeader('Content-Type', 'image/png');
        if (download) {
          res.setHeader('Content-Disposition', `attachment; filename="qrcode-vip-${slug}.png"`);
        }
        res.send(buffer);
      }
    } catch (err: any) {
      console.error('Erro ao gerar QRCode:', err);
      res.status(500).json({ error: 'Erro ao gerar QR Code.' });
    }
  });

  // Unknown API paths return JSON 404s instead of the SPA's index.html.
  app.use('/api', (req: Request, res: Response) => {
    console.info(`[api] ${req.method} ${req.path} status=404 reason=route_not_found`);
    res.status(404).json({ error: 'API route not found.' });
  });

  // ==========================================
  // VITE DEV SERVER OR STATIC SERVING
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  return app;
}

// Local execution opens a listener; Vercel's function bundle must never call listen().
const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
if (!isVercelRuntime && process.env.NODE_ENV !== 'production' &&
  process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const PORT = Number(process.env.PORT) || 3000;
  createApp().then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Sistema VIP] Servidor rodando na porta ${PORT}`);
    });
  }).catch((err) => {
    console.error('[Sistema VIP] Falha crítica ao iniciar servidor:', err?.name || 'unknown');
    process.exit(1);
  });
}
