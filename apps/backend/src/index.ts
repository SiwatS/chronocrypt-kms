import { Elysia } from 'elysia';

const app = new Elysia()
  .get('/', () => ({
    message: 'Welcome to ChronoCrypt KMS API',
    version: '1.0.0',
    status: 'running'
  }))
  .get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString()
  }))
  .group('/api', (app) =>
    app
      .get('/keys', () => ({
        keys: []
      }))
      .post('/keys', ({ body }) => ({
        message: 'Key created',
        data: body
      }))
  )
  .listen(3001);

console.log(
  `🦊 Elysia backend is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
