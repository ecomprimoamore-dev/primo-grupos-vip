import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../server';

type VercelRequest = IncomingMessage & { url?: string };

/**
 * Vercel rewrites every public /api/:path* request to this concrete function,
 * carrying its original path in __path. Restore the Express URL so existing
 * route matching, methods, request bodies, and query strings remain unchanged.
 */
export default function handler(req: VercelRequest, res: ServerResponse) {
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
  app(req as any, res as any);
}
