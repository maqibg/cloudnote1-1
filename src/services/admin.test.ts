import { describe, expect, it, vi } from 'vitest';
import {
  createNoteByPath,
  getNoteByPath,
  importNotes,
  listNotes,
  updateNoteByPath,
} from './admin';
import { createMockBindings } from '../test-utils/mockBindings';

describe('admin services', () => {
  it('rejects creating a locked note without a password', async () => {
    const env = createMockBindings();

    const result = await createNoteByPath(env, {
      path: 'locked-note',
      content: '<p>secret</p>',
      is_locked: true,
      lock_type: 'write',
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: 'Password required when creating a locked note',
    });
  });

  it('rejects locking an existing note without a password when no hash exists', async () => {
    const env = createMockBindings([
      {
        path: 'plain-note',
        content: 'hello',
      },
    ]);

    const result = await updateNoteByPath(env, 'plain-note', {
      is_locked: true,
      lock_type: 'write',
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: 'Password required when locking a note that has no existing password',
    });
  });

  it('fails importing a locked note without password material', async () => {
    const env = createMockBindings();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const result = await importNotes(env, {
        notes: [
          {
            path: 'broken-note',
            content: 'secret',
            is_locked: true,
          },
        ],
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        imported: 0,
        failed: 1,
        total: 1,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('does not expose password_hash in admin detail and list responses', async () => {
    const env = createMockBindings([
      {
        path: 'secure-note',
        content: '<p>safe</p>',
        is_locked: true,
        lock_type: 'write',
        password_hash: 'abc:def',
        view_count: 3,
      },
    ]);

    const detail = await getNoteByPath(env, 'secure-note');
    const list = await listNotes(env);

    expect(detail.status).toBe(200);
    expect(
      'password_hash' in ((detail.body as unknown) as Record<string, unknown>),
    ).toBe(false);
    expect(
      'password_hash' in ((list.body.notes[0] as unknown) as Record<string, unknown>),
    ).toBe(false);
  });
});
