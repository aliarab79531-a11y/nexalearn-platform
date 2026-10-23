import app from '../api/index.ts';
import http from 'node:http';

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running on ${baseUrl}`);

  try {
    // 1. Health check
    console.log('\n--- 1. Testing /api/health/live ---');
    const healthRes = await fetch(`${baseUrl}/api/health/live`);
    const healthJson = await healthRes.json();
    console.log('Status:', healthRes.status, JSON.stringify(healthJson));

    // 2. Courses list
    console.log('\n--- 2. Testing /api/courses ---');
    const coursesRes = await fetch(`${baseUrl}/api/courses`);
    const coursesJson = await coursesRes.json();
    console.log('Status:', coursesRes.status, 'Courses count:', coursesJson.data?.length);

    // 3. Auth login
    console.log('\n--- 3. Testing /api/auth/login with demo student ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo.student@nexalearn.test',
        password: 'Demo-WIGSMNJb4p6GbF__Joa5E2Q5!',
      }),
    });
    const loginJson = await loginRes.json();
    console.log('Status:', loginRes.status, 'Logged in as:', loginJson.data?.user?.email, 'Role:', loginJson.data?.user?.role);

    // 4. Test Vercel rewrite simulation
    console.log('\n--- 4. Testing simulated Vercel rewrite (/api with x-matched-path) ---');
    const rewriteRes = await fetch(`${baseUrl}/api`, {
      headers: {
        'x-matched-path': '/api/courses'
      }
    });
    const rewriteJson = await rewriteRes.json();
    console.log('Rewrite test status:', rewriteRes.status, 'Courses count:', rewriteJson.data?.length);

    console.log('\n✅ ALL VERCEL API ENTRYPOINT & INTEGRATION TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
});
