import type {
  AdminLog,
  Bindings,
  D1PreparedStatement,
  D1Result,
  Note,
} from '../types';

interface MockState {
  logs: AdminLog[];
  notes: Map<string, Note>;
  objects: Map<string, string>;
  kv: Map<string, string>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneNote(note: Note): Note {
  return {
    ...note,
    content: note.content ?? '',
    password_hash: note.password_hash ?? null,
    lock_type: note.lock_type ?? null,
  };
}

function createBaseNote(note: Partial<Note> & Pick<Note, 'path'>): Note {
  const timestamp = nowIso();
  return {
    path: note.path,
    content: note.content ?? '',
    is_locked: note.is_locked ?? false,
    lock_type: note.lock_type ?? null,
    password_hash: note.password_hash ?? null,
    created_at: note.created_at ?? timestamp,
    updated_at: note.updated_at ?? timestamp,
    view_count: note.view_count ?? 0,
  };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function parseLikeQuery(notes: Note[], search: string) {
  if (!search) {
    return notes;
  }

  const keyword = search.replaceAll('%', '').toLowerCase();
  return notes.filter((note) =>
    note.path.toLowerCase().includes(keyword)
    || (note.content ?? '').toLowerCase().includes(keyword),
  );
}

function updateNoteFromAssignments(note: Note, assignments: string[], values: unknown[]) {
  let valueIndex = 0;

  for (const assignment of assignments) {
    const trimmed = assignment.trim();

    if (trimmed === 'updated_at = CURRENT_TIMESTAMP') {
      note.updated_at = nowIso();
      continue;
    }

    if (trimmed === 'lock_type = NULL') {
      note.lock_type = null;
      continue;
    }

    if (trimmed === 'password_hash = NULL') {
      note.password_hash = null;
      continue;
    }

    const [field] = trimmed.split('=').map((part) => part.trim());
    const value = values[valueIndex];
    valueIndex += 1;

    switch (field) {
      case 'content':
        note.content = String(value ?? '');
        break;
      case 'is_locked':
        note.is_locked = Boolean(value);
        break;
      case 'lock_type':
        note.lock_type = (value as Note['lock_type']) ?? null;
        break;
      case 'password_hash':
        note.password_hash = value ? String(value) : null;
        break;
      case 'view_count':
        note.view_count = Number(value ?? 0);
        break;
      default:
        throw new Error(`Unhandled assignment: ${trimmed}`);
    }
  }
}

export function createMockBindings(
  seedNotes: Array<Partial<Note> & Pick<Note, 'path'>> = [],
): Bindings & { __state: MockState } {
  const state: MockState = {
    notes: new Map(seedNotes.map((note) => [note.path, createBaseNote(note)])),
    kv: new Map(),
    objects: new Map(),
    logs: [],
  };

  const db = {
    prepare(sql: string): D1PreparedStatement {
      let boundValues: unknown[] = [];
      const normalizedSql = normalizeSql(sql);

      function getNotesArray(): Note[] {
        return Array.from(state.notes.values()).map(cloneNote);
      }

      function getCountResult(count: number) {
        return { count };
      }

      async function selectOne(): Promise<unknown> {
        if (normalizedSql === 'SELECT * FROM notes WHERE path = ?') {
          const note = state.notes.get(String(boundValues[0]));
          return note ? cloneNote(note) : null;
        }

        if (normalizedSql === 'SELECT 1 FROM notes WHERE path = ?') {
          return state.notes.has(String(boundValues[0])) ? 1 : null;
        }

        if (normalizedSql === 'SELECT COUNT(*) as count FROM notes') {
          return getCountResult(state.notes.size);
        }

        if (normalizedSql === 'SELECT COUNT(*) as count FROM notes WHERE is_locked = 1') {
          return getCountResult(
            getNotesArray().filter((note) => note.is_locked).length,
          );
        }

        if (normalizedSql === 'SELECT SUM(view_count) as total FROM notes') {
          return {
            total: getNotesArray().reduce((sum, note) => sum + note.view_count, 0),
          };
        }

        if (normalizedSql.startsWith('SELECT COUNT(*) as count FROM notes WHERE path LIKE ? OR content LIKE ?')) {
          const search = String(boundValues[0] ?? '');
          return getCountResult(parseLikeQuery(getNotesArray(), search).length);
        }

        throw new Error(`Unhandled first() SQL: ${sql}`);
      }

      async function selectMany<T>(): Promise<D1Result<T>> {
        if (normalizedSql.startsWith('SELECT * FROM notes WHERE path LIKE ? OR content LIKE ?')) {
          const search = String(boundValues[0] ?? '');
          const limit = Number(boundValues[2] ?? 20);
          const offset = Number(boundValues[3] ?? 0);
          const results = parseLikeQuery(getNotesArray(), search)
            .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
            .slice(offset, offset + limit) as T[];
          return { results, success: true, meta: { changes: 0 } };
        }

        if (normalizedSql.startsWith('SELECT * FROM notes ORDER BY updated_at DESC LIMIT ? OFFSET ?')) {
          const limit = Number(boundValues[0] ?? 20);
          const offset = Number(boundValues[1] ?? 0);
          const results = getNotesArray()
            .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
            .slice(offset, offset + limit) as T[];
          return { results, success: true, meta: { changes: 0 } };
        }

        if (normalizedSql === 'SELECT * FROM notes ORDER BY path') {
          const results = getNotesArray()
            .sort((left, right) => left.path.localeCompare(right.path)) as T[];
          return { results, success: true, meta: { changes: 0 } };
        }

        if (normalizedSql === 'SELECT * FROM admin_logs ORDER BY timestamp DESC LIMIT 100') {
          const results = [...state.logs]
            .sort((left, right) => right.timestamp.localeCompare(left.timestamp)) as T[];
          return { results, success: true, meta: { changes: 0 } };
        }

        throw new Error(`Unhandled all() SQL: ${sql}`);
      }

      async function mutate(): Promise<D1Result> {
        if (normalizedSql === 'INSERT INTO notes (path, content, is_locked, lock_type, password_hash) VALUES (?, ?, ?, ?, ?)') {
          const [path, content, isLocked, lockType, passwordHash] = boundValues;
          state.notes.set(String(path), {
            path: String(path),
            content: String(content ?? ''),
            is_locked: Boolean(isLocked),
            lock_type: (lockType as Note['lock_type']) ?? null,
            password_hash: passwordHash ? String(passwordHash) : null,
            created_at: nowIso(),
            updated_at: nowIso(),
            view_count: 0,
          });
          return { results: [], success: true, meta: { changes: 1 } };
        }

        if (normalizedSql.startsWith('INSERT OR REPLACE INTO notes')) {
          const [path, content, isLocked, lockType, passwordHash] = boundValues;
          const existing = state.notes.get(String(path));
          state.notes.set(String(path), {
            path: String(path),
            content: String(content ?? ''),
            is_locked: Boolean(isLocked),
            lock_type: (lockType as Note['lock_type']) ?? null,
            password_hash: passwordHash ? String(passwordHash) : null,
            created_at: existing?.created_at ?? nowIso(),
            updated_at: nowIso(),
            view_count: existing?.view_count ?? 0,
          });
          return { results: [], success: true, meta: { changes: 1 } };
        }

        if (normalizedSql.startsWith('UPDATE notes SET view_count = view_count + 1 WHERE path = ?')) {
          const note = state.notes.get(String(boundValues[0]));
          if (note) {
            note.view_count += 1;
            note.updated_at = nowIso();
          }
          return { results: [], success: true, meta: { changes: note ? 1 : 0 } };
        }

        if (normalizedSql.startsWith('UPDATE notes SET')) {
          const path = String(boundValues[boundValues.length - 1]);
          const note = state.notes.get(path);
          if (!note) {
            return { results: [], success: true, meta: { changes: 0 } };
          }

          const setSql = sql.split('SET')[1]?.split('WHERE')[0] ?? '';
          const assignments = setSql.split(',').map((part) => part.trim()).filter(Boolean);
          updateNoteFromAssignments(note, assignments, boundValues.slice(0, -1));
          return { results: [], success: true, meta: { changes: 1 } };
        }

        if (normalizedSql === 'DELETE FROM notes WHERE path = ?') {
          const existed = state.notes.delete(String(boundValues[0]));
          return { results: [], success: true, meta: { changes: existed ? 1 : 0 } };
        }

        if (normalizedSql === 'INSERT INTO admin_logs (action, target_path, details) VALUES (?, ?, ?)') {
          const [action, targetPath, details] = boundValues;
          state.logs.push({
            id: state.logs.length + 1,
            action: String(action),
            target_path: targetPath ? String(targetPath) : null,
            timestamp: nowIso(),
            details: details ? String(details) : null,
          });
          return { results: [], success: true, meta: { changes: 1 } };
        }

        throw new Error(`Unhandled run() SQL: ${sql}`);
      }

      return {
        bind(...values: unknown[]) {
          boundValues = values;
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const result = await selectOne();
          if (!result) {
            return null;
          }

          if (colName && typeof result === 'object') {
            return ((result as Record<string, unknown>)[colName] as T) ?? null;
          }

          return result as T;
        },
        async all<T = unknown>(): Promise<D1Result<T>> {
          return selectMany<T>();
        },
        async run(): Promise<D1Result> {
          return mutate();
        },
        async raw<T = unknown>(): Promise<T[]> {
          const { results } = await selectMany<T>();
          return results;
        },
      };
    },
  };

  const bindings: Bindings & { __state: MockState } = {
    __state: state,
    DB: db,
    CACHE: {
      async get(key: string) {
        return state.kv.get(key) ?? null;
      },
      async put(key: string, value: string) {
        state.kv.set(key, value);
      },
      async delete(key: string) {
        state.kv.delete(key);
      },
      async list() {
        return {
          keys: Array.from(state.kv.keys()).map((name) => ({ name })),
        };
      },
    },
    STORAGE: {
      async put(key: string, value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string) {
        state.objects.set(key, typeof value === 'string' ? value : '[binary]');
        return null;
      },
      async get(key: string) {
        const value = state.objects.get(key);
        if (value === undefined) {
          return null;
        }

          return {
            key,
            async arrayBuffer() {
              const encoded = new TextEncoder().encode(value);
              return encoded.buffer.slice(
                encoded.byteOffset,
                encoded.byteOffset + encoded.byteLength,
              ) as ArrayBuffer;
            },
          async text() {
            return value;
          },
          async json<T = unknown>() {
            return JSON.parse(value) as T;
          },
          async blob() {
            return new Blob([value]);
          },
        };
      },
      async delete(key: string) {
        state.objects.delete(key);
      },
      async list() {
        return {
          objects: Array.from(state.objects.keys()).map((key) => ({ key })),
        };
      },
    },
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin-password',
    JWT_SECRET: 'secret',
    PATH_MIN_LENGTH: '1',
    PATH_MAX_LENGTH: '20',
    RATE_LIMIT_PER_MINUTE: '60',
    SESSION_DURATION: '86400',
  };

  return bindings;
}
