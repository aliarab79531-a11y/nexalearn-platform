import app from './api-app';

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
