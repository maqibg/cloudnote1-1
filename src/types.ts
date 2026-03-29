export type LockType = 'read' | 'write';

export interface D1ResultMeta {
  changes?: number;
  duration?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
  changed_db?: boolean;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: D1ResultMeta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatement;
  batch?<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec?(sql: string): D1Result;
  close?(): void;
}

export interface KVGetOptions {
  type?: 'text' | 'json';
}

export interface KVPutOptions {
  expirationTtl?: number;
}

export interface KVNamespaceLike {
  get(key: string, options?: KVGetOptions): Promise<string | null>;
  put(key: string, value: string, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string; limit?: number }): Promise<{
    keys: Array<{ name: string }>;
  }>;
}

export interface R2ObjectLike {
  key: string;
  body?: ReadableStream | null;
  bodyUsed?: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string; limit?: number }): Promise<unknown>;
  head?(key: string): Promise<R2ObjectLike | null>;
}

export interface Bindings {
  DB: D1DatabaseLike;
  CACHE: KVNamespaceLike;
  STORAGE: R2BucketLike;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
  PATH_MIN_LENGTH: string;
  PATH_MAX_LENGTH: string;
  RATE_LIMIT_PER_MINUTE: string;
  SESSION_DURATION: string;
}

export interface AppVariables {
  user?: JWTPayload;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: AppVariables;
}

export interface Note {
  path: string;
  content: string | null;
  is_locked: boolean;
  lock_type: LockType | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
}

export interface NoteResponse {
  exists: boolean;
  content?: string | null;
  is_locked?: boolean;
  lock_type?: LockType | null;
  requires_password?: boolean;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminLog {
  id: number;
  action: string;
  target_path?: string | null;
  timestamp: string;
  details?: string | null;
}

export interface NotePublic {
  path: string;
  content: string | null;
  is_locked: boolean;
  lock_type: LockType | null;
  created_at: string;
  updated_at: string;
  view_count: number;
}

export interface JWTPayload {
  sub: string;
  exp: number;
  iat: number;
  role: 'admin';
}

export interface UnlockRequest {
  password: string;
}

export interface LockRequest {
  password: string;
  lock_type: LockType;
}

export interface SaveNoteRequest {
  content: string;
  password?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ImportNotePayload {
  path: string;
  content: string;
  is_locked?: boolean;
  lock_type?: LockType;
  password?: string;
  password_hash?: string | null;
}

export interface ImportRequest {
  notes: ImportNotePayload[];
}

export type ResponseStatus = 200 | 400 | 401 | 403 | 404 | 409 | 429 | 500;

export interface ServiceResult<T> {
  status: ResponseStatus;
  body: T;
}

export interface AppExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
