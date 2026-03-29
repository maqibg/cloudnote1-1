import crypto from 'node:crypto';
import { FilterXSS, type IFilterXSSOptions } from 'xss';

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9-_]+$/;

const XSS_OPTIONS: IFilterXSSOptions = {
  allowCommentTag: false,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  whiteList: {
    a: ['href', 'target', 'rel'],
    b: [],
    blockquote: [],
    br: [],
    code: [],
    div: ['align'],
    em: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    hr: [],
    i: [],
    img: ['src', 'alt', 'width', 'height'],
    li: [],
    ol: [],
    p: ['align'],
    pre: [],
    s: [],
    span: ['style'],
    strong: [],
    sub: [],
    sup: [],
    u: [],
    ul: [],
  },
  css: {
    whiteList: {
      'background-color': true,
      color: true,
      'font-size': true,
      'text-align': true,
    },
  },
  onIgnoreTagAttr(tag, name, value) {
    if (tag === 'img' && name === 'src' && value.startsWith('data:image/')) {
      return `${name}="${value}"`;
    }

    return undefined;
  },
};

const xssFilter = new FilterXSS(XSS_OPTIONS);

function derivePasswordHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256',
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = await derivePasswordHash(password, salt);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(':');

  if (!saltHex || !keyHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await derivePasswordHash(password, salt);

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

export function generateRandomPath(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += chars[bytes[index] % chars.length];
  }

  return result;
}

export function validatePath(path: string, minLength: number, maxLength: number): boolean {
  if (
    !path ||
    path === 'admin' ||
    path === 'api' ||
    path === 'static' ||
    path === 'health'
  ) {
    return false;
  }

  if (path.length < minLength || path.length > maxLength) {
    return false;
  }

  return SAFE_PATH_PATTERN.test(path);
}

export function sanitizeHtml(html: string): string {
  return xssFilter.process(html);
}
