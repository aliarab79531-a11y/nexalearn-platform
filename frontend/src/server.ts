import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

app.use(helmet({ contentSecurityPolicy: false }));

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

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express SSR server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
