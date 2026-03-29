import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { rateLimiter } from './middleware/rateLimiter';
import { adminRoutes } from './routes/admin';
import { apiRoutes } from './routes/api';
import { noteRoutes } from './routes/note';
import type { AppEnv } from './types';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.quilljs.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.quilljs.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  }));
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use('*', rateLimiter());

  app.route('/api', apiRoutes);
  app.route('/admin', adminRoutes);
  app.get('/health', (c) => c.text('healthy\n', 200));
  app.route('/', noteRoutes);

  app.onError((err, c) => {
    console.error('Application error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  return app;
}

const app = createApp();

export default app;
