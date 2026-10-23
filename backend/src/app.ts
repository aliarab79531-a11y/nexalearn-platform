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

app.use((request, response, next) => {
  const origin = request.get('origin');
  if (!origin) {
    next();
    return;
  }
  if (allowedOrigins.has(origin.replace(/\/+$/, ''))) {
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

// Normalize /api prefix if accessed via cloud serverless function
app.use((request, _response, next) => {
  if (!request.path.startsWith('/api')) {
    request.url = `/api${request.url}`;
  }
  next();
});

app.use('/api', (request, response, next) => {
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
app.use('/api', jsend);
app.use('/api', express.json({ limit: '32kb', strict: true }));
app.use('/api', createAuthRouter());
app.use('/api', createDomainRouter());
app.use('/api', (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
});
app.use('/api', apiErrorHandler);

export default app;
