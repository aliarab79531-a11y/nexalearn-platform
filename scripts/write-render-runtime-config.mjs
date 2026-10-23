import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const configuredApiBaseUrl = (process.env.API_BASE_URL || '').trim();
if (!configuredApiBaseUrl) {
  throw new Error('Set API_BASE_URL to the backend Render service URL before building the static frontend.');
}

const parsedApiBaseUrl = new URL(configuredApiBaseUrl);
if (parsedApiBaseUrl.protocol !== 'https:' || parsedApiBaseUrl.pathname !== '/' || parsedApiBaseUrl.search || parsedApiBaseUrl.hash) {
  throw new Error('API_BASE_URL must be an HTTPS origin with no path, query, or fragment.');
}

const output = resolve('dist/ai-learning-platform/browser/runtime-config.js');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `window.__NEXALEARN_CONFIG__ = ${JSON.stringify({ apiBaseUrl: parsedApiBaseUrl.origin })};\n`);
