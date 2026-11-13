import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../../server';

type VercelRequest = IncomingMessage & { url?: string };

/** Restore the original /api path passed through the Vercel rewrite. */
let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: VercelRequest, res: ServerResponse) {
  const rewrittenUrl = new URL(req.url || '/', 'http://vercel.internal');
  const originalPath = rewrittenUrl.searchParams.get('__path');
  if (!originalPath || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(originalPath)) {
    res.statusCode = originalPath ? 400 : 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'API route not found.' }));
    return;
  }

  rewrittenUrl.searchParams.delete('__path');
  const query = rewrittenUrl.searchParams.toString();
  req.url = `/api/${originalPath}${query ? `?${query}` : ''}`;
  try {
    const app = await (appPromise ||= createApp());
    app(req as any, res as any);
  } catch (error: any) {
    console.error(`[vercel-api] express initialization failed code=${error?.name || 'unknown'}`);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'API indisponível no momento.' }));
    }
  }
}
