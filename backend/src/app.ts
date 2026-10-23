import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { apiErrorHandler } from './api-errors';
import { createAuthRouter } from './auth-api';
import { createDomainRouter } from './domain-api';
import { jsend } from './jsend';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));

// Render and other reverse proxies forward the original client address. Trust
// the platform proxy so rate limits apply to clients instead of the proxy.
if (process.env['NODE_ENV'] === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = new Set([
  ...(process.env['FRONTEND_URL'] || '').split(','),
  'http://localhost:4200',
  'http://127.0.0.1:4200',
].map(origin => origin.trim().replace(/\/+$/, '')).filter(Boolean));

// Vercel serverless proxy rewrites /api/* to /api; restore original path from Vercel headers if present
app.use((request, _response, next) => {
  const matched = (request.headers['x-matched-path'] || request.headers['x-vercel-matched-path']) as string | undefined;
  if (matched && matched.startsWith('/api') && (request.url === '/api' || request.url === '/' || request.url.startsWith('/api?'))) {
    const query = request.url.includes('?') ? '?' + request.url.split('?')[1] : '';
    request.url = matched + query;
  }
  next();
});

app.use((request, response, next) => {
  const origin = request.get('origin');
  if (!origin) {
    next();
    return;
  }
  let isVercel = false;
  try {
    isVercel = /\.vercel\.app$/.test(new URL(origin).hostname);
  } catch {
    isVercel = false;
  }
  const host = request.get('host');
  if (allowedOrigins.has(origin.replace(/\/+$/, '')) || isVercel || origin === `https://${host}` || origin === `http://${host}`) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
    response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
    response.setHeader('Access-Control-Max-Age', '600');
    response.append('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
  }
  next();
});

const apiRouter = express.Router();

apiRouter.use((request, response, next) => {
  const startedAt = performance.now();
  const requestId = randomUUID();
  response.setHeader('X-Request-Id', requestId);
  response.setHeader('Cache-Control', 'no-store');
  response.on('finish', () => {
    console.info(JSON.stringify({
      level: 'info',
      event: 'api.request',
      requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    }));
  });
  next();
});

apiRouter.use(jsend);
apiRouter.use(express.json({ limit: '32kb', strict: true }));
apiRouter.use(createAuthRouter());
apiRouter.use(createDomainRouter());
apiRouter.use((_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
});
apiRouter.use(apiErrorHandler);

// Mount router on both /api (when path retains prefix) and root / (when serverless proxy strips /api)
app.use('/api', apiRouter);
app.use(apiRouter);

export default app;
