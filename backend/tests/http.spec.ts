import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env['FRONTEND_URL'] = 'https://frontend.example';
let server: import('node:http').Server;
let serverUrl = '';

before(async () => {
  const { default: app } = await import('../src/app');
  server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  serverUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

function baseUrl(): string {
  return serverUrl;
}

test('liveness endpoint responds without database configuration', async () => {
  const response = await fetch(`${baseUrl()}/api/health/live`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'success', data: { status: 'live' } });
});

test('configured frontend receives credentialed CORS preflight headers', async () => {
  const response = await fetch(`${baseUrl()}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://frontend.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://frontend.example');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});

test('unconfigured origins do not receive CORS permission', async () => {
  const response = await fetch(`${baseUrl()}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
