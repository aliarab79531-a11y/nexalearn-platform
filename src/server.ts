import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const browserDistFolder = (() => {
  const candidates = [
    join(process.cwd(), 'dist', 'ai-learning-platform', 'browser'),
    join(process.cwd(), 'browser'),
    join(import.meta.dirname ?? process.cwd(), '../browser'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
})();

const app = express();
const angularApp = new AngularNodeAppEngine();
let authRouterPromise: Promise<express.Router> | undefined;
let domainRouterPromise: Promise<express.Router> | undefined;
const lazyApiErrorHandler: ErrorRequestHandler = (error, request, response, next) => {
  void import('./server/api-errors')
    .then(({ apiErrorHandler }) => apiErrorHandler(error, request, response, next))
    .catch(next);
};

app.use(helmet({ contentSecurityPolicy: false }));
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
app.use('/api', express.json({ limit: '32kb', strict: true }));
app.use('/api', (request, response, next) => {
  authRouterPromise ??= import('./server/auth-api').then(({ createAuthRouter }) => createAuthRouter());
  void authRouterPromise.then(router => router(request, response, next)).catch(next);
});
app.use('/api', (request, response, next) => {
  domainRouterPromise ??= import('./server/domain-api').then(({ createDomainRouter }) => createDomainRouter());
  void domainRouterPromise.then(router => router(request, response, next)).catch(next);
});
app.use('/api', (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
});
app.use('/api', lazyApiErrorHandler);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
    redirect: true,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
