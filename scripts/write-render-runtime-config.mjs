import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const rawUrl = (process.env.API_BASE_URL || '').trim();
let apiBaseUrl = '';

if (rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    apiBaseUrl = parsed.origin;
  } catch {
    apiBaseUrl = rawUrl.replace(/\/+$/, '');
  }
}

// Find the dist directory whether script is run from project root or frontend/
let targetDir = resolve('dist/ai-learning-platform/browser');
if (!existsSync(targetDir) && existsSync(resolve('frontend/dist/ai-learning-platform/browser'))) {
  targetDir = resolve('frontend/dist/ai-learning-platform/browser');
}

await mkdir(targetDir, { recursive: true });
const targetFile = resolve(targetDir, 'runtime-config.js');

const config = `window.__NEXALEARN_CONFIG__ = ${JSON.stringify({ apiBaseUrl })};\n`;
await writeFile(targetFile, config);
console.log(`[Render Config] Wrote runtime-config.js to ${targetFile} (apiBaseUrl: "${apiBaseUrl || '(same origin)'}")`);
