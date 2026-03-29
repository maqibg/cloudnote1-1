import { describe, expect, it } from 'vitest';
import { fetchNote } from './notes';
import { createMockBindings } from '../test-utils/mockBindings';

describe('notes services', () => {
  it('caches public note data without password hash and increments visible view count', async () => {
    const env = createMockBindings([
      {
        path: 'cache-note',
        content: '<p>hello</p>',
        is_locked: true,
        lock_type: 'write',
        password_hash: 'salt:hash',
        view_count: 2,
      },
    ]);

    const executionCtx = {
      waitUntil(promise: Promise<unknown>) {
        void promise;
      },
    };

    const result = await fetchNote(env, executionCtx, 'cache-note');
    const cached = env.__state.kv.get('note:cache-note');

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      exists: true,
      is_locked: true,
      lock_type: 'write',
      view_count: 3,
    });
    expect(cached).toBeDefined();
    expect(cached).not.toContain('password_hash');
  });

  it('returns password-gated response for read locked notes', async () => {
    const env = createMockBindings([
      {
        path: 'read-locked',
        content: '<p>hidden</p>',
        is_locked: true,
        lock_type: 'read',
        password_hash: 'salt:hash',
      },
    ]);

    const executionCtx = {
      waitUntil(promise: Promise<unknown>) {
        void promise;
      },
    };

    const result = await fetchNote(env, executionCtx, 'read-locked');

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      exists: true,
      is_locked: true,
      lock_type: 'read',
      requires_password: true,
      view_count: 1,
    });
  });
});
