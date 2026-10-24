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
  resolve(root, 'public'),
  resolve(root, 'backend'),
  resolve(root, 'backend/api'),
  resolve(root, 'backend/public'),
];

for (const dir of targetDirs) {
  await mkdir(dir, { recursive: true });
}

console.log('[build-api] Bundling backend into all possible Vercel entrypoint locations...');

const targets = [
  resolve(root, 'api/index.js'),
  resolve(root, 'public/index.js'),
  resolve(root, 'public/app.js'),
  resolve(root, 'public/server.js'),
  resolve(root, 'backend/index.js'),
  resolve(root, 'backend/app.js'),
  resolve(root, 'backend/server.js'),
  resolve(root, 'backend/api/index.js'),
  resolve(root, 'backend/public/index.js'),
  resolve(root, 'backend/public/app.js'),
  resolve(root, 'backend/public/server.js'),
];

for (const outfile of targets) {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile,
    sourcemap: false,
    target: 'node20',
  });
}

// Create wildcard [...path].js proxy files
const proxyContent = "export { default } from './index.js';\n";
await writeFile(resolve(root, 'api/[...path].js'), proxyContent, 'utf8');
await writeFile(resolve(root, 'backend/api/[...path].js'), proxyContent, 'utf8');

console.log('[build-api] Successfully bundled all entrypoints for Vercel deployment.');
