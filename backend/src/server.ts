import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import app from './app';
import { getDatabase } from './database';

// Load .env from current backend directory and parent directory if available
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../.env') });

const port = Number(process.env['PORT'] || process.env['API_PORT'] || 4301);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT or API_PORT must be a valid TCP port.');
}

const server = app.listen(port, (error) => {
  if (error) {
    throw error;
  }
  console.log(`NexaLearn API server listening on http://localhost:${port}`);
  void getDatabase().then(() => {
    console.log('MongoDB Atlas connected and ready.');
  }).catch((err: unknown) => {
    console.warn('Database note:', err instanceof Error ? err.message : 'ready');
  });
});

export default server;
