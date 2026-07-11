import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { getRecord, getShareByToken, listFiles, putAudit } from "@/lib/repository";
import { safeJson } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({ token: z.string().min(40).max(100) });

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const { token } = safeJson(schema, await readJson(request));
    const share = await getShareByToken(token);
    if (!share || share.revokedAt || new Date(share.expiresAt).getTime() <= Date.now()) throw new HttpError(404, "This share link is invalid or expired");
    const record = await getRecord(share.ownerId, share.personId, share.recordId);
    if (!record) throw new HttpError(404, "This share link is invalid or expired");
    const files = share.includeFiles ? (await listFiles(share.ownerId, share.personId, share.recordId)).filter((file) => file.status === "uploaded").map((file) => ({
      id: file.id, recordId: file.recordId, personId: file.personId, fileName: file.fileName,
      contentType: file.contentType, size: file.size, status: file.status, createdAt: file.createdAt,
    })) : [];
    await putAudit(share.ownerId, "share.viewed", { personId: share.personId, recordId: share.recordId, shareId: share.id });
    return json({ data: { record, files, expiresAt: share.expiresAt } });
  }, { sameOrigin: true });
}
