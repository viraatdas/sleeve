import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

function decodeKey(value: string): Buffer {
  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32) return base64;
  const hex = Buffer.from(value, "hex");
  if (hex.length === 32) return hex;
  throw new Error("DATA_ENCRYPTION_KEY must encode exactly 32 bytes");
}

export function encryptJson(value: unknown, encodedKey = process.env.DATA_ENCRYPTION_KEY): string {
  if (!encodedKey) throw new Error("DATA_ENCRYPTION_KEY is not configured");
  const key = decodeKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptJson<T>(envelope: string, encodedKey = process.env.DATA_ENCRYPTION_KEY): T {
  if (!encodedKey) throw new Error("DATA_ENCRYPTION_KEY is not configured");
  const [version, ivValue, tagValue, ciphertextValue, extra] = envelope.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue || extra) throw new Error("Invalid encrypted envelope");
  const decipher = createDecipheriv("aes-256-gcm", decodeKey(encodedKey), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function hmacValue(value: string, secret = process.env.AUTH_SECRET): string {
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function emailKey(email: string, secret = process.env.AUTH_SECRET): string {
  return hmacValue(email.trim().toLowerCase(), secret);
}

export function generateOtp(): string {
  const value = randomBytes(4).readUInt32BE() % 1_000_000;
  return value.toString().padStart(6, "0");
}
