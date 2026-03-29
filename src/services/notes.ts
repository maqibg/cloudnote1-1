import { getPathLengthRange } from '../config';
import {
  generateRandomPath,
  hashPassword,
  sanitizeHtml,
  validatePath,
  verifyPassword,
} from '../utils/crypto';
import type {
  AppExecutionContext,
  Bindings,
  LockRequest,
  Note,
  NotePublic,
  NoteResponse,
  SaveNoteRequest,
  ServiceResult,
  UnlockRequest,
} from '../types';

const CACHE_TTL_FACTOR = 180;
const CACHE_VIEW_THRESHOLD = 2;
const MAX_CACHE_TTL = 86400;
const MAX_GENERATE_ATTEMPTS = 10;
const MIN_CACHE_TTL = 300;
const RESERVED_PATHS = new Set(['admin', 'api', 'static', 'health']);

function getCacheKey(path: string): string {
  return `note:${path}`;
}

function getPathLength(path: string): number {
  return path.trim().length;
}

function isValidNotePath(env: Bindings, path: string): boolean {
  const { minLength, maxLength } = getPathLengthRange(env);
  return validatePath(path, minLength, maxLength);
}

function invalidPathResult(): ServiceResult<{ error: string }> {
  return {
    status: 400,
    body: { error: 'Invalid path' },
  };
}

function toLockedReadResponse(note: Note): NoteResponse {
  return {
    exists: true,
    is_locked: true,
    lock_type: 'read',
    requires_password: true,
    view_count: note.view_count,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

function toNotePublic(note: Note): NotePublic {
  return {
    path: note.path,
    content: note.content ?? '',
    is_locked: note.is_locked,
    lock_type: note.lock_type,
    created_at: note.created_at,
    updated_at: note.updated_at,
    view_count: note.view_count,
  };
}

function toVisibleNote(note: Note): NoteResponse {
  if (note.is_locked && note.lock_type === 'read') {
    return toLockedReadResponse(note);
  }

  return {
    exists: true,
    ...toNotePublic(note),
    requires_password: false,
  };
}

function toUnlockedNote(note: Note): NoteResponse {
  return {
    exists: true,
    content: note.content ?? '',
    is_locked: note.is_locked,
    lock_type: note.lock_type,
    requires_password: false,
    view_count: note.view_count,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

async function findNote(env: Bindings, path: string): Promise<Note | null> {
  return env.DB.prepare('SELECT * FROM notes WHERE path = ?').bind(path).first<Note>();
}

async function incrementViewCount(env: Bindings, path: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE notes SET view_count = view_count + 1 WHERE path = ?',
  ).bind(path).run();
}

function scheduleCacheWrite(
  env: Bindings,
  executionCtx: AppExecutionContext,
  note: Note,
): void {
  if (note.view_count < CACHE_VIEW_THRESHOLD) {
    return;
  }

  const expirationTtl = Math.min(
    MAX_CACHE_TTL,
    Math.max(MIN_CACHE_TTL, note.view_count * CACHE_TTL_FACTOR),
  );

  const responseBody = toVisibleNote({
    ...note,
    view_count: note.view_count + 1,
  });

  executionCtx.waitUntil(
    env.CACHE.put(getCacheKey(note.path), JSON.stringify(responseBody), {
      expirationTtl,
    }),
  );
}

function sanitizeContent(content: string): string {
  return sanitizeHtml(content).trim();
}

export async function fetchNote(
  env: Bindings,
  executionCtx: AppExecutionContext,
  path: string,
): Promise<ServiceResult<NoteResponse | { error: string }>> {
  if (!isValidNotePath(env, path)) {
    return invalidPathResult();
  }

  const cached = await env.CACHE.get(getCacheKey(path));
  if (cached) {
    const note = JSON.parse(cached) as NoteResponse;
    await incrementViewCount(env, path);
    return {
      status: 200,
      body: {
        ...note,
        view_count: (note.view_count ?? 0) + 1,
      },
    };
  }

  const note = await findNote(env, path);
  if (!note) {
    return {
      status: 200,
      body: { exists: false },
    };
  }

  executionCtx.waitUntil(incrementViewCount(env, path));
  scheduleCacheWrite(env, executionCtx, note);

  return {
    status: 200,
    body: toVisibleNote({
      ...note,
      view_count: note.view_count + 1,
    }),
  };
}

export async function saveNote(
  env: Bindings,
  path: string,
  body: SaveNoteRequest,
): Promise<ServiceResult<{ error: string } | { success: true }>> {
  if (!isValidNotePath(env, path)) {
    return invalidPathResult();
  }

  const content = sanitizeContent(body.content ?? '');
  if (!content) {
    return {
      status: 400,
      body: { error: 'Content cannot be empty' },
    };
  }

  const existing = await findNote(env, path);
  if (existing?.is_locked && existing.lock_type === 'write') {
    if (!body.password) {
      return {
        status: 403,
        body: { error: 'Password required for editing' },
      };
    }

    const valid = await verifyPassword(body.password, existing.password_hash ?? '');
    if (!valid) {
      return {
        status: 403,
        body: { error: 'Invalid password' },
      };
    }
  }

  if (existing) {
    await env.DB.prepare(
      'UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE path = ?',
    ).bind(content, path).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO notes (path, content) VALUES (?, ?)',
    ).bind(path, content).run();
  }

  await env.CACHE.delete(getCacheKey(path));

  return {
    status: 200,
    body: { success: true },
  };
}

export async function unlockNote(
  env: Bindings,
  path: string,
  body: UnlockRequest,
): Promise<ServiceResult<{ error: string } | { success: true; note: NoteResponse }>> {
  if (!isValidNotePath(env, path)) {
    return invalidPathResult();
  }

  const note = await findNote(env, path);
  if (!note) {
    return {
      status: 404,
      body: { error: 'Note not found' },
    };
  }

  if (!note.is_locked || !note.password_hash) {
    return {
      status: 400,
      body: { error: 'Note is not locked' },
    };
  }

  const valid = await verifyPassword(body.password, note.password_hash);
  if (!valid) {
    return {
      status: 403,
      body: { error: 'Invalid password' },
    };
  }

  await env.CACHE.delete(getCacheKey(path));

  return {
    status: 200,
    body: {
      success: true,
      note: toUnlockedNote(note),
    },
  };
}

export async function lockNote(
  env: Bindings,
  path: string,
  body: LockRequest,
): Promise<ServiceResult<{ error: string } | { success: true }>> {
  if (!isValidNotePath(env, path)) {
    return invalidPathResult();
  }

  if (!body.password || !body.lock_type) {
    return {
      status: 400,
      body: { error: 'Password and lock_type required' },
    };
  }

  const note = await findNote(env, path);
  if (!note) {
    return {
      status: 404,
      body: { error: 'Note not found' },
    };
  }

  const passwordHash = await hashPassword(body.password);
  await env.DB.prepare(
    'UPDATE notes SET is_locked = 1, lock_type = ?, password_hash = ? WHERE path = ?',
  ).bind(body.lock_type, passwordHash, path).run();

  await env.CACHE.delete(getCacheKey(path));

  return {
    status: 200,
    body: { success: true },
  };
}

export async function removeNoteLock(
  env: Bindings,
  path: string,
  password: string,
): Promise<ServiceResult<{ error: string } | { success: true }>> {
  if (!isValidNotePath(env, path)) {
    return invalidPathResult();
  }

  const note = await findNote(env, path);
  if (!note) {
    return {
      status: 404,
      body: { error: 'Note not found' },
    };
  }

  if (!note.is_locked || !note.password_hash) {
    return {
      status: 400,
      body: { error: 'Note is not locked' },
    };
  }

  const valid = await verifyPassword(password, note.password_hash);
  if (!valid) {
    return {
      status: 403,
      body: { error: 'Invalid password' },
    };
  }

  await env.DB.prepare(
    'UPDATE notes SET is_locked = 0, lock_type = NULL, password_hash = NULL WHERE path = ?',
  ).bind(path).run();

  await env.CACHE.delete(getCacheKey(path));

  return {
    status: 200,
    body: { success: true },
  };
}

export async function generateAvailablePath(
  env: Bindings,
): Promise<ServiceResult<{ error: string } | { path: string }>> {
  const { minLength, maxLength } = getPathLengthRange(env);
  const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
    const path = generateRandomPath(length);
    const existing = await env.DB.prepare(
      'SELECT 1 FROM notes WHERE path = ?',
    ).bind(path).first();

    if (!existing) {
      return {
        status: 200,
        body: { path },
      };
    }
  }

  return {
    status: 500,
    body: { error: 'Could not generate unique path' },
  };
}

export async function resolveRootPath(
  env: Bindings,
): Promise<ServiceResult<{ error: string } | { path: string }>> {
  const emptyNote = await env.DB.prepare(
    `SELECT path FROM notes
     WHERE content = '' OR content IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
  ).first<{ path: string }>();

  if (emptyNote) {
    return {
      status: 200,
      body: { path: emptyNote.path },
    };
  }

  return generateAvailablePath(env);
}

export function isReservedPath(path: string): boolean {
  return RESERVED_PATHS.has(path);
}

export function isRenderablePath(env: Bindings, path: string): boolean {
  if (isReservedPath(path)) {
    return false;
  }

  return isValidNotePath(env, path) && getPathLength(path) > 0;
}
