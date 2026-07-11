import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { randomToken, hashToken } from "@/lib/crypto";
import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { getRecord, listSharesForRecord, putAudit, putShare } from "@/lib/repository";
import { safeJson, shareCreateSchema } from "@/lib/validation";
import type { ShareGrant } from "@/types/domain";

export const runtime = "nodejs";
type Context = { params: Promise<{ personId: string; recordId: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    if (!await getRecord(ownerId, personId, recordId)) throw new HttpError(404, "Not found");
    return json({ data: await listSharesForRecord(ownerId, personId, recordId) });
  });
}

export async function POST(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    if (!await getRecord(ownerId, personId, recordId)) throw new HttpError(404, "Not found");
    const input = safeJson(shareCreateSchema, await readJson(request));
    const token = randomToken();
    const now = new Date();
    const share: ShareGrant = {
      id: randomUUID(), ownerId, personId, recordId, includeFiles: input.includeFiles,
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + input.expiresInMinutes * 60_000).toISOString(),
    };
    await putShare(ownerId, share, hashToken(token));
    await putAudit(ownerId, "share.created", { personId, recordId, shareId: share.id });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    // The fragment is not sent in HTTP requests, keeping the bearer token out of access logs.
    return json({ data: { id: share.id, expiresAt: share.expiresAt, url: `${base.replace(/\/$/, "")}/share#token=${token}` } }, 201);
  }, { sameOrigin: true });
}
