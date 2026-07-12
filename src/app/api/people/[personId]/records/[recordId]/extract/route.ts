import { requireSession } from "@/lib/auth";
import { extractDocument } from "@/lib/extraction";
import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { getFile, getRecord, putAudit } from "@/lib/repository";
import { presignDownload } from "@/lib/storage";
import { safeJson } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 180;
type Context = { params: Promise<{ personId: string; recordId: string }> };
const inputSchema = z.object({ fileId: z.string().uuid() });

export async function POST(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId, recordId } = await params;
    const record = await getRecord(ownerId, personId, recordId);
    if (!record) throw new HttpError(404, "Not found");
    const { fileId } = safeJson(inputSchema, await readJson(request));
    const file = await getFile(ownerId, personId, recordId, fileId);
    if (!file) throw new HttpError(404, "Not found");
    if (file.status !== "uploaded") throw new HttpError(409, "Upload is not complete");
    const documentType = record.kind === "drivers_license" ? "driver_license" : record.kind;
    if (documentType === "other" || file.contentType === "application/pdf") throw new HttpError(422, "Extraction supports known document types and images only");
    // The draft is returned for the owner's review; nothing is stored until they
    // confirm it through a record update.
    const result = await extractDocument(await presignDownload(file, 90), file.contentType, documentType);
    await putAudit(ownerId, "record.extraction_ready", { personId, recordId, fileId });
    return json({ data: result });
  }, { sameOrigin: true });
}
