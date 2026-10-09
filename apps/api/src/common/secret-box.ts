import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for small secrets stored in Mongo (provider refresh tokens).
 * The 32-byte key comes pre-validated from config (TOKEN_ENCRYPTION_KEY).
 * Output: base64url of iv | auth tag | ciphertext. GCM's tag means a
 * tampered value fails to decrypt instead of returning garbage.
 */
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function decryptSecret(sealed: string, key: Buffer): string {
  const raw = Buffer.from(sealed, "base64url");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8"
  );
}
