import { describe, expect, it } from 'vitest';
import { hashPassword, sanitizeHtml, verifyPassword } from './crypto';

describe('crypto utilities', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('secret-password');

    await expect(verifyPassword('secret-password', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('sanitizes dangerous html while preserving safe formatting', () => {
    const dirty = `
      <p onclick="alert(1)">hello <strong>world</strong></p>
      <script>alert('xss')</script>
      <a href="javascript:alert(1)">bad</a>
      <img src="x" onerror="alert(1)" />
    `;

    const clean = sanitizeHtml(dirty);

    expect(clean).toContain('<strong>world</strong>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick=');
    expect(clean).not.toContain('onerror=');
    expect(clean).not.toContain('javascript:');
  });
});
