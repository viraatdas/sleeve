import { requireSession } from "@/lib/auth";
import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { deleteFile, deleteRecord, getRecord, listFiles, putAudit, putRecord } from "@/lib/repository";
import { removeObject } from "@/lib/storage";
import { recordUpdateSchema, safeJson } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ personId: string; recordId: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    const record = await getRecord(ownerId, personId, recordId);
    if (!record) throw new HttpError(404, "Not found");
    return json({ data: { ...record, files: await listFiles(ownerId, personId, recordId) } });
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    const record = await getRecord(ownerId, personId, recordId);
    if (!record) throw new HttpError(404, "Not found");
    const input = safeJson(recordUpdateSchema, await readJson(request));
    const updated = { ...record, ...input, id: record.id, personId, createdAt: record.createdAt, updatedAt: new Date().toISOString() };
    await putRecord(ownerId, updated);
    await putAudit(ownerId, "record.updated", { personId, recordId });
    return json({ data: updated });
  }, { sameOrigin: true });
}

export async function DELETE(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    if (!await getRecord(ownerId, personId, recordId)) throw new HttpError(404, "Not found");
    for (const file of await listFiles(ownerId, personId, recordId)) {
      await removeObject(file);
      await deleteFile(ownerId, personId, recordId, file.id);
    }
    await deleteRecord(ownerId, personId, recordId);
    await putAudit(ownerId, "record.deleted", { personId, recordId });
    return json({ data: { deleted: true } });
  }, { sameOrigin: true });
}
