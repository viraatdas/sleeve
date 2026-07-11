import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { getRecord, listFiles, putAudit, putFile } from "@/lib/repository";
import { presignUpload, uploadHeaders } from "@/lib/storage";
import { safeJson, uploadSchema } from "@/lib/validation";
import type { StoredFile } from "@/types/domain";

export const runtime = "nodejs";
type Context = { params: Promise<{ personId: string; recordId: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    if (!await getRecord(ownerId, personId, recordId)) throw new HttpError(404, "Not found");
    return json({ data: await listFiles(ownerId, personId, recordId) });
  });
}

export async function POST(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    if (!await getRecord(ownerId, personId, recordId)) throw new HttpError(404, "Not found");
    const input = safeJson(uploadSchema, await readJson(request));
    const id = randomUUID();
    const prefix = (process.env.SLEEVE_DOCUMENTS_PREFIX ?? "private").replace(/^\/+|\/+$/g, "");
    const file: StoredFile = {
      id, personId, recordId, ...input, objectKey: `${prefix}/owners/${ownerId}/people/${personId}/records/${recordId}/${id}`,
      status: "pending", createdAt: new Date().toISOString(),
    };
    await putFile(ownerId, file);
    const uploadUrl = await presignUpload(file);
    await putAudit(ownerId, "file.upload_authorized", { personId, recordId, fileId: id });
    return json({ data: { file, uploadUrl, uploadHeaders: uploadHeaders(file), expiresInSeconds: 300 } }, 201);
  }, { sameOrigin: true });
}
