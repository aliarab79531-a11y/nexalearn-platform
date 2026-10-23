import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const node = process.execPath;

const backendDir = existsSync(resolve(root, 'backend')) ? resolve(root, 'backend') : root;
const frontendDir = existsSync(resolve(root, 'frontend')) ? resolve(root, 'frontend') : root;

const backendScript = existsSync(resolve(backendDir, 'src/server.ts'))
  ? 'src/server.ts'
  : 'src/api-dev.ts';

const children = [
  spawn(node, [
    '--import',
    'tsx',
    '--env-file-if-exists=.env',
    '--env-file-if-exists=../.env',
    backendScript,
  ], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(node, [resolve(root, 'node_modules/@angular/cli/bin/ng.js'), 'serve'], {
    cwd: frontendDir,
    stdio: 'inherit',
    env: process.env,
  }),
];

let stopping = false;
function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.once('error', error => {
    console.error('Could not start a development service:', error.message);
    stopAll(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`A development service stopped${signal ? ` (${signal})` : ` with exit code ${code ?? 1}`}.`);
      stopAll(code || 1);
    }
  });
}

process.once('SIGINT', () => stopAll(0));
process.once('SIGTERM', () => stopAll(0));
