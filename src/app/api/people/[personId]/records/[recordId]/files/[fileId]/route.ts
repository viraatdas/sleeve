import { requireSession } from "@/lib/auth";
import { handleApi, HttpError, json } from "@/lib/http";
import { deleteFile, getFile, putAudit, updateFile } from "@/lib/repository";
import { presignDownload, removeObject, verifyUploadedObject } from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ personId: string; recordId: string; fileId: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId, fileId } = await params;
    const file = await getFile(ownerId, personId, recordId, fileId);
    if (!file) throw new HttpError(404, "Not found");
    if (file.status !== "uploaded") throw new HttpError(409, "Upload is not complete");
    const downloadUrl = await presignDownload(file);
    await putAudit(ownerId, "file.download_authorized", { personId, recordId, fileId });
    return json({ data: { downloadUrl, expiresInSeconds: 120 } });
  }, { sameOrigin: true });
}

export async function DELETE(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId, fileId } = await params;
    const file = await getFile(ownerId, personId, recordId, fileId);
    if (!file) throw new HttpError(404, "Not found");
    await removeObject(file);
    await deleteFile(ownerId, personId, recordId, fileId);
    await putAudit(ownerId, "file.deleted", { personId, recordId, fileId });
    return json({ data: { deleted: true } });
  }, { sameOrigin: true });
}

export async function PATCH(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId, fileId } = await params;
    const file = await getFile(ownerId, personId, recordId, fileId);
    if (!file) throw new HttpError(404, "Not found");
    let versionId: string;
    try {
      versionId = await verifyUploadedObject(file);
    } catch (error) {
      await removeObject(file).catch(() => undefined);
      await deleteFile(ownerId, personId, recordId, fileId).catch(() => undefined);
      throw error;
    }
    const completed = { ...file, versionId, status: "uploaded" as const };
    await updateFile(ownerId, completed);
    await putAudit(ownerId, "file.upload_completed", { personId, recordId, fileId });
    return json({ data: completed });
  }, { sameOrigin: true });
}
