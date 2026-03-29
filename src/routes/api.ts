import { Hono } from 'hono';
import {
  fetchNote,
  generateAvailablePath,
  lockNote,
  removeNoteLock,
  saveNote,
  unlockNote,
} from '../services/notes';
import type {
  AppEnv,
  LockRequest,
  SaveNoteRequest,
  UnlockRequest,
} from '../types';

const api = new Hono<AppEnv>();

api.get('/note/:path', async (c) => {
  const result = await fetchNote(c.env, c.executionCtx, c.req.param('path'));
  return c.json(result.body, result.status);
});

api.post('/note/:path', async (c) => {
  const body = await c.req.json<SaveNoteRequest>();
  const result = await saveNote(c.env, c.req.param('path'), body);
  return c.json(result.body, result.status);
});

api.post('/note/:path/unlock', async (c) => {
  const body = await c.req.json<UnlockRequest>();
  const result = await unlockNote(c.env, c.req.param('path'), body);
  return c.json(result.body, result.status);
});

api.post('/note/:path/lock', async (c) => {
  const body = await c.req.json<LockRequest>();
  const result = await lockNote(c.env, c.req.param('path'), body);
  return c.json(result.body, result.status);
});

api.delete('/note/:path/lock', async (c) => {
  const body = await c.req.json<{ password: string }>();
  const result = await removeNoteLock(
    c.env,
    c.req.param('path'),
    body.password,
  );

  return c.json(result.body, result.status);
});

api.get('/generate-path', async (c) => {
  const result = await generateAvailablePath(c.env);
  return c.json(result.body, result.status);
});

export { api as apiRoutes };
