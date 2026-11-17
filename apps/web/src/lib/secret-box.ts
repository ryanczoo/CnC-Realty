import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_KEY;
  if (!raw) throw new Error("GOOGLE_TOKEN_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("GOOGLE_TOKEN_KEY must be base64 of exactly 32 bytes");
  return key;
}

/** AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function sealSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

export function openSecret(sealed: string): string {
  const key = getKey();
  const parts = sealed.split(".");
  if (parts.length !== 3) throw new Error("Malformed sealed secret");
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64url"));
  if (iv.length !== 12) throw new Error("Malformed sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
