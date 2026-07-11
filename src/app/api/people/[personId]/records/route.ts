import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { getPerson, listRecords, putAudit, putRecord } from "@/lib/repository";
import { recordCreateSchema, safeJson } from "@/lib/validation";
import type { SleeveRecord } from "@/types/domain";

export const runtime = "nodejs";
type Context = { params: Promise<{ personId: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId } = await params;
    if (!await getPerson(ownerId, personId)) throw new HttpError(404, "Not found");
    return json({ data: await listRecords(ownerId, personId) });
  });
}

export async function POST(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId } = await params;
    if (!await getPerson(ownerId, personId)) throw new HttpError(404, "Not found");
    const input = safeJson(recordCreateSchema, await readJson(request));
    const now = new Date().toISOString();
    const record: SleeveRecord = {
      id: randomUUID(), personId, ...input,
      reminderDaysBefore: input.expiresOn && input.reminderDaysBefore === undefined ? 30 : input.reminderDaysBefore,
      createdAt: now, updatedAt: now,
    };
    await putRecord(ownerId, record, true);
    await putAudit(ownerId, "record.created", { personId, recordId: record.id });
    return json({ data: record }, 201);
  }, { sameOrigin: true });
}
