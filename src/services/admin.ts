import { getPathLengthRange, getSessionDuration } from '../config';
import { createJWT } from '../utils/jwt';
import {
  hashPassword,
  sanitizeHtml,
  validatePath,
  verifyPassword,
} from '../utils/crypto';
import type {
  AdminLog,
  Bindings,
  ImportRequest,
  LockType,
  LoginRequest,
  Note,
  NotePublic,
  ServiceResult,
} from '../types';

export interface AdminStats {
  total_notes: number;
  locked_notes: number;
  total_views: number;
}

export interface ListNotesQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AdminNoteListItem {
  path: string;
  is_locked: boolean;
  lock_type: LockType | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminNoteDetail extends NotePublic {}

export interface NotesListResponse {
  notes: AdminNoteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateAdminNoteInput {
  content?: string;
  is_locked?: boolean;
  lock_type?: LockType;
  password?: string;
}

export interface CreateAdminNoteInput extends UpdateAdminNoteInput {
  path: string;
}

function getCacheKey(path: string): string {
  return `note:${path}`;
}

function getExportsKey(name: string): string {
  return `exports/${name}`;
}

function getBackupsKey(name: string): string {
  return `backups/${name}`;
}

function buildFilename(prefix: 'backup' | 'export', now = Date.now()): string {
  return `${prefix}-${now}.json`;
}

function normalizePagination(query: ListNotesQuery) {
  const rawPage = query.page ?? 1;
  const rawLimit = query.limit ?? 20;
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, rawLimit))
    : 20;
  const search = (query.search ?? '').trim();

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    search,
  };
}

function getSearchClause(search: string) {
  if (!search) {
    return {
      whereSql: '',
      params: [] as string[],
    };
  }

  const like = `%${search}%`;
  return {
    whereSql: ' WHERE path LIKE ? OR content LIKE ?',
    params: [like, like],
  };
}

function sanitizeOptionalContent(content?: string): string | undefined {
  if (content === undefined) {
    return undefined;
  }

  return sanitizeHtml(content);
}

function toAdminNoteDetail(note: Note): AdminNoteDetail {
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

function toAdminListItem(note: Note): AdminNoteListItem {
  return {
    path: note.path,
    is_locked: note.is_locked,
    lock_type: note.lock_type,
    view_count: note.view_count,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

function validateAdminPath(env: Bindings, path: string): boolean {
  const { minLength, maxLength } = getPathLengthRange(env);
  return validatePath(path, minLength, maxLength);
}

async function writeAdminLog(
  env: Bindings,
  action: string,
  details: string,
  targetPath?: string,
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO admin_logs (action, target_path, details) VALUES (?, ?, ?)',
  ).bind(action, targetPath ?? null, details).run();
}

async function isValidAdminPassword(
  env: Bindings,
  password: string,
): Promise<boolean> {
  const hashedMatch = await verifyPassword(password, env.ADMIN_PASSWORD);
  return hashedMatch || password === env.ADMIN_PASSWORD;
}

async function getExistingNote(env: Bindings, path: string): Promise<Note | null> {
  return env.DB.prepare('SELECT * FROM notes WHERE path = ?').bind(path).first<Note>();
}

function buildExportData(notes: Note[]) {
  return {
    version: '2.0',
    exported_at: new Date().toISOString(),
    notes,
  };
}

function buildBackupData(notes: Note[]) {
  return {
    version: '2.0',
    created_at: new Date().toISOString(),
    notes,
  };
}

function resolveImportedPasswordHash(note: ImportRequest['notes'][number]): string | null {
  if (note.password_hash) {
    return note.password_hash;
  }

  if (note.password) {
    return null;
  }

  return null;
}

async function importOneNote(env: Bindings, note: ImportRequest['notes'][number]) {
  if (!validateAdminPath(env, note.path)) {
    throw new Error(`Invalid path: ${note.path}`);
  }

  if (note.is_locked && !note.password && !note.password_hash) {
    throw new Error(`Locked note requires password or password_hash: ${note.path}`);
  }

  const passwordHash = resolveImportedPasswordHash(note)
    ?? (note.password ? await hashPassword(note.password) : null);
  const lockType = note.is_locked ? note.lock_type ?? 'write' : null;

  await env.DB.prepare(
    `INSERT OR REPLACE INTO notes
     (path, content, is_locked, lock_type, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    note.path,
    sanitizeHtml(note.content),
    note.is_locked ? 1 : 0,
    lockType,
    passwordHash,
  ).run();
}

export async function loginAdmin(
  env: Bindings,
  body: LoginRequest,
): Promise<ServiceResult<
  { error: string } |
  { success: true; token: string; expires_in: number; expiresIn: number }
>> {
  if (body.username !== env.ADMIN_USERNAME) {
    return {
      status: 401,
      body: { error: 'Invalid credentials' },
    };
  }

  const validPassword = await isValidAdminPassword(env, body.password);
  if (!validPassword) {
    return {
      status: 401,
      body: { error: 'Invalid credentials' },
    };
  }

  const duration = getSessionDuration(env);
  const token = await createJWT(env.JWT_SECRET, body.username, duration);

  await writeAdminLog(env, 'login', `Admin ${body.username} logged in`);

  return {
    status: 200,
    body: {
      success: true,
      token,
      expires_in: duration,
      expiresIn: duration,
    },
  };
}

export async function getAdminStats(
  env: Bindings,
): Promise<ServiceResult<AdminStats>> {
  const totalNotes = await env.DB
    .prepare('SELECT COUNT(*) as count FROM notes')
    .first<number>('count');
  const lockedNotes = await env.DB
    .prepare('SELECT COUNT(*) as count FROM notes WHERE is_locked = 1')
    .first<number>('count');
  const totalViews = await env.DB
    .prepare('SELECT SUM(view_count) as total FROM notes')
    .first<{ total: number | null }>();

  return {
    status: 200,
    body: {
      total_notes: totalNotes ?? 0,
      locked_notes: lockedNotes ?? 0,
      total_views: totalViews?.total ?? 0,
    },
  };
}

export async function listNotes(
  env: Bindings,
  query: ListNotesQuery = {},
): Promise<ServiceResult<NotesListResponse>> {
  const pagination = normalizePagination(query);
  const searchClause = getSearchClause(pagination.search);

  const sql = `SELECT * FROM notes${searchClause.whereSql}
    ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) as count FROM notes${searchClause.whereSql}`;

  const { results } = await env.DB.prepare(sql)
    .bind(...searchClause.params, pagination.limit, pagination.offset)
    .all<Note>();
  const total = await env.DB.prepare(countSql)
    .bind(...searchClause.params)
    .first<number>('count');

  return {
    status: 200,
    body: {
      notes: results.map(toAdminListItem),
      total: total ?? 0,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil((total ?? 0) / pagination.limit)),
    },
  };
}

export async function getNoteByPath(
  env: Bindings,
  path: string,
): Promise<ServiceResult<{ error: string } | AdminNoteDetail>> {
  const note = await getExistingNote(env, path);

  if (!note) {
    return {
      status: 404,
      body: { error: 'Note not found' },
    };
  }

  return {
    status: 200,
    body: toAdminNoteDetail(note),
  };
}

export async function createNoteByPath(
  env: Bindings,
  input: CreateAdminNoteInput,
): Promise<ServiceResult<{ error: string } | { success: true; path: string }>> {
  if (!input.path || !validateAdminPath(env, input.path)) {
    return {
      status: 400,
      body: { error: 'Invalid path' },
    };
  }

  if (input.is_locked && !input.password) {
    return {
      status: 400,
      body: { error: 'Password required when creating a locked note' },
    };
  }

  const existing = await getExistingNote(env, input.path);
  if (existing) {
    return {
      status: 409,
      body: { error: 'Path already exists' },
    };
  }

  const content = sanitizeOptionalContent(input.content) ?? '';
  const isLocked = !!input.is_locked;
  const lockType = isLocked ? input.lock_type ?? 'write' : null;
  const passwordHash = isLocked ? await hashPassword(input.password!) : null;

  await env.DB.prepare(
    'INSERT INTO notes (path, content, is_locked, lock_type, password_hash) VALUES (?, ?, ?, ?, ?)',
  ).bind(
    input.path,
    content,
    isLocked ? 1 : 0,
    lockType,
    passwordHash,
  ).run();

  await writeAdminLog(env, 'create', `Created note: ${input.path}`, input.path);

  return {
    status: 200,
    body: {
      success: true,
      path: input.path,
    },
  };
}

export async function updateNoteByPath(
  env: Bindings,
  path: string,
  input: UpdateAdminNoteInput,
): Promise<ServiceResult<{ error: string } | { success: true }>> {
  const existing = await getExistingNote(env, path);

  if (!existing) {
    return {
      status: 404,
      body: { error: 'Note not found' },
    };
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.content !== undefined) {
    updates.push('content = ?');
    values.push(sanitizeHtml(input.content));
  }

  if (input.is_locked !== undefined) {
    updates.push('is_locked = ?');
    values.push(input.is_locked ? 1 : 0);

    if (input.is_locked) {
      if (!existing.password_hash && !input.password) {
        return {
          status: 400,
          body: { error: 'Password required when locking a note that has no existing password' },
        };
      }

      const nextLockType = input.lock_type ?? existing.lock_type ?? 'write';
      updates.push('lock_type = ?');
      values.push(nextLockType);

      if (input.password) {
        updates.push('password_hash = ?');
        values.push(await hashPassword(input.password));
      }
    } else {
      updates.push('lock_type = NULL');
      updates.push('password_hash = NULL');
    }
  } else if (input.lock_type && existing.is_locked) {
    updates.push('lock_type = ?');
    values.push(input.lock_type);
  }

  if (updates.length === 0) {
    return {
      status: 400,
      body: { error: 'No updates provided' },
    };
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(path);

  await env.DB.prepare(
    `UPDATE notes SET ${updates.join(', ')} WHERE path = ?`,
  ).bind(...values).run();

  await env.CACHE.delete(getCacheKey(path));
  await writeAdminLog(env, 'update', `Updated note: ${path}`, path);

  return {
    status: 200,
    body: { success: true },
  };
}

export async function deleteNoteByPath(
  env: Bindings,
  path: string,
): Promise<ServiceResult<{ error: string } | { success: true }>> {
  const result = await env.DB.prepare('DELETE FROM notes WHERE path = ?').bind(path).run();

  if (result.meta?.changes === 0) {
    return {
      status: 404,
      body: { error: 'Note not found' },
    };
  }

  await env.CACHE.delete(getCacheKey(path));
  await writeAdminLog(env, 'delete', `Deleted note: ${path}`, path);

  return {
    status: 200,
    body: { success: true },
  };
}

export async function exportNotes(
  env: Bindings,
): Promise<ServiceResult<{ success: true; filename: string; count: number; data: unknown }>> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM notes ORDER BY path',
  ).all<Note>();

  const exportData = buildExportData(results);
  const filename = buildFilename('export');
  await env.STORAGE.put(getExportsKey(filename), JSON.stringify(exportData, null, 2));
  await writeAdminLog(env, 'export', `Exported ${results.length} notes to ${filename}`);

  return {
    status: 200,
    body: {
      success: true,
      filename,
      count: results.length,
      data: exportData,
    },
  };
}

export async function createBackup(
  env: Bindings,
): Promise<ServiceResult<{ success: true; filename: string; size: number; notes: number }>> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM notes ORDER BY path',
  ).all<Note>();

  const backup = buildBackupData(results);
  const serialized = JSON.stringify(backup, null, 2);
  const filename = buildFilename('backup');
  await env.STORAGE.put(getBackupsKey(filename), serialized);
  await writeAdminLog(env, 'backup', `Created backup ${filename}`);

  return {
    status: 200,
    body: {
      success: true,
      filename,
      size: serialized.length,
      notes: results.length,
    },
  };
}

export async function importNotes(
  env: Bindings,
  body: ImportRequest,
): Promise<ServiceResult<{ error: string } | { success: true; imported: number; failed: number; total: number }>> {
  if (!body.notes || !Array.isArray(body.notes)) {
    return {
      status: 400,
      body: { error: 'Invalid import data' },
    };
  }

  let imported = 0;
  let failed = 0;

  for (const note of body.notes) {
    try {
      await importOneNote(env, note);
      await env.CACHE.delete(getCacheKey(note.path));
      imported += 1;
    } catch (error) {
      console.error(`Failed to import note ${note.path}:`, error);
      failed += 1;
    }
  }

  await writeAdminLog(env, 'import', `Imported ${imported} notes, ${failed} failed`);

  return {
    status: 200,
    body: {
      success: true,
      imported,
      failed,
      total: body.notes.length,
    },
  };
}

export async function listAdminLogs(
  env: Bindings,
): Promise<ServiceResult<{ logs: AdminLog[] }>> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT 100',
  ).all<AdminLog>();

  return {
    status: 200,
    body: { logs: results },
  };
}
