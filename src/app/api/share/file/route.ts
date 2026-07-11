import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { getFile, getShareByToken, putAudit } from "@/lib/repository";
import { presignDownload } from "@/lib/storage";
import { safeJson } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";
const schema = z.object({ token: z.string().min(40).max(100), fileId: z.string().uuid() });

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const { token, fileId } = safeJson(schema, await readJson(request));
    const share = await getShareByToken(token);
    if (!share || !share.includeFiles || share.revokedAt || new Date(share.expiresAt).getTime() <= Date.now()) throw new HttpError(404, "This share link is invalid or expired");
    const file = await getFile(share.ownerId, share.personId, share.recordId, fileId);
    if (!file || file.status !== "uploaded") throw new HttpError(404, "Not found");
    const remaining = Math.max(1, Math.floor((new Date(share.expiresAt).getTime() - Date.now()) / 1000));
    const expiresInSeconds = Math.min(remaining, 120);
    const downloadUrl = await presignDownload(file, expiresInSeconds);
    await putAudit(share.ownerId, "share.file_downloaded", { recordId: share.recordId, shareId: share.id, fileId });
    return json({ data: { downloadUrl, expiresInSeconds } });
  }, { sameOrigin: true });
}
