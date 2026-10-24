import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const entryPoint = resolve(root, 'backend/src/app.ts');
const targetDirs = [
  resolve(root, 'api'),
  resolve(root, 'backend/api'),
];

for (const dir of targetDirs) {
  await mkdir(dir, { recursive: true });
}

console.log('[build-api] Bundling backend into Vercel serverless function entrypoints...');

// Build api/index.js
await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: resolve(root, 'api/index.js'),
  sourcemap: false,
  target: 'node20',
});

// Build backend/api/index.js
await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: resolve(root, 'backend/api/index.js'),
  sourcemap: false,
  target: 'node20',
});

// Create [...path].js wildcards that re-export index.js
const proxyContent = "export { default } from './index.js';\n";
await writeFile(resolve(root, 'api/[...path].js'), proxyContent, 'utf8');
await writeFile(resolve(root, 'backend/api/[...path].js'), proxyContent, 'utf8');

console.log('[build-api] Successfully bundled serverless API entrypoints:');
console.log(' - api/index.js & api/[...path].js');
console.log(' - backend/api/index.js & backend/api/[...path].js');
