import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { apiErrorHandler } from './server/api-errors';
import { createAuthRouter } from './server/auth-api';
import { createDomainRouter } from './server/domain-api';

const app = express();
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
app.use('/api', createAuthRouter());
app.use('/api', createDomainRouter());
app.use('/api', (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
});
app.use('/api', apiErrorHandler);

const port = Number(process.env['API_PORT'] || 4301);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be a valid TCP port.');
}

app.listen(port, (error) => {
  if (error) {
    throw error;
  }
  console.log(`NexaLearn API listening on http://localhost:${port}`);
});
