import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * הצפנת מפתחות ה-API של המשתמשים (AES-256-GCM).
 * מפתח ההצפנה נגזר מ-JWT_SECRET — המפתחות לעולם לא נשמרים גלויים במסד.
 */

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`pensia-ai:${secret}`).digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string, secret: string): string {
  const [ivB64, tagB64, encB64] = stored.split(':');
  const key = deriveKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** תצוגה מוסתרת: sk-ant-...Xy4Z */
export function maskKey(plain: string): string {
  if (plain.length <= 10) return '••••';
  return `${plain.slice(0, 7)}…${plain.slice(-4)}`;
}
