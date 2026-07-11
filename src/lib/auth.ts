import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { decryptJson, emailKey, encryptJson, generateOtp, hashToken, hmacValue, randomToken, safeEqual } from "./crypto";
import { consumeOtp, createOwner, deleteSession, failOtpAttempt, getOtp, getOwnerByEmailHash, getSession, putAudit, putOtp, putSession } from "./repository";
import { sendLoginCode } from "./email";
import { HttpError } from "./http";
import type { SessionIdentity } from "@/types/domain";

export const sessionCookieName = process.env.NODE_ENV === "production" ? "__Host-sleeve_session" : "sleeve_session";
const genericAuthError = new HttpError(401, "The code is invalid or expired");

export async function requestLoginCode(email: string): Promise<void> {
  const allowlist = (process.env.SLEEVE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length && !allowlist.includes(email.trim().toLowerCase())) return;
  const key = emailKey(email);
  const existing = await getOtp(key);
  const now = Math.floor(Date.now() / 1000);
  const rateWindowStart = existing && existing.rateWindowStart > now - 3600 ? existing.rateWindowStart : now;
  const sendCount = existing && rateWindowStart === existing.rateWindowStart ? existing.sendCount + 1 : 1;
  if (sendCount > 5 || (existing && existing.lastSentAt > now - 60)) throw new HttpError(429, "Please wait before requesting another code");
  const code = generateOtp();
  await putOtp(key, {
    codeHash: hmacValue(`${key}:${code}`), encryptedEmail: encryptJson(email), expiresAt: now + 600,
    attempts: 0, sendCount, rateWindowStart, lastSentAt: now, version: randomUUID(),
  }, existing?.version);
  try { await sendLoginCode(email, code); }
  catch {
    // Keep the persisted rate limit even if delivery fails; do not expose provider details.
    throw new HttpError(503, "Email is temporarily unavailable");
  }
}

export async function verifyLoginCode(email: string, code: string, remember: boolean): Promise<{ token: string; identity: SessionIdentity; maxAge: number }> {
  const key = emailKey(email);
  const item = await getOtp(key);
  const now = Math.floor(Date.now() / 1000);
  if (!item || item.expiresAt <= now || item.consumedAt || item.attempts >= 5) throw genericAuthError;
  if (!safeEqual(item.codeHash, hmacValue(`${key}:${code}`))) {
    try { await failOtpAttempt(key, item.version, now); } catch { /* generic response below */ }
    throw genericAuthError;
  }
  try { await consumeOtp(key, item.version, now); } catch { throw genericAuthError; }
  let owner = await getOwnerByEmailHash(key);
  let ownerId: string;
  if (owner) ownerId = owner.ownerId;
  else {
    try { ownerId = await createOwner(key, item.encryptedEmail); }
    catch {
      owner = await getOwnerByEmailHash(key);
      if (!owner) throw new HttpError(503, "Unable to sign in");
      ownerId = owner.ownerId;
    }
  }
  const maxAge = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const token = randomToken();
  await putSession(hashToken(token), ownerId, item.encryptedEmail, now + maxAge);
  await putAudit(ownerId, "session.created");
  return { token, maxAge, identity: { ownerId, email: decryptJson<string>(item.encryptedEmail), expiresAt: new Date((now + maxAge) * 1000).toISOString() } };
}

export async function currentSession(): Promise<SessionIdentity | undefined> {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  if (!token) return;
  const session = await getSession(hashToken(token));
  const now = Math.floor(Date.now() / 1000);
  if (!session || session.expiresAt <= now) return;
  return { ownerId: session.ownerId, email: session.email, expiresAt: new Date(session.expiresAt * 1000).toISOString() };
}

export async function requireSession(): Promise<SessionIdentity> {
  const session = await currentSession();
  if (!session) throw new HttpError(401, "Sign in required");
  return session;
}

export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  if (!token) return;
  const session = await getSession(hashToken(token));
  await deleteSession(hashToken(token));
  if (session) await putAudit(session.ownerId, "session.revoked");
}
