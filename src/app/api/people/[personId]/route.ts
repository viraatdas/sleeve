import { requireSession } from "@/lib/auth";
import { handleApi, HttpError, json, readJson } from "@/lib/http";
import { deletePerson, getPerson, putAudit, putPerson } from "@/lib/repository";
import { personUpdateSchema, safeJson } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ personId: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId } = await params;
    const person = await getPerson(ownerId, personId);
    if (!person) throw new HttpError(404, "Not found");
    return json({ data: person });
  });
}

export async function PATCH(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId } = await params;
    const person = await getPerson(ownerId, personId);
    if (!person) throw new HttpError(404, "Not found");
    const input = safeJson(personUpdateSchema, await readJson(request));
    const updated = { ...person, ...input, id: person.id, createdAt: person.createdAt, updatedAt: new Date().toISOString() };
    await putPerson(ownerId, updated);
    await putAudit(ownerId, "person.updated", { personId });
    return json({ data: updated });
  }, { sameOrigin: true });
}

export async function DELETE(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { personId } = await params;
    if (!await getPerson(ownerId, personId)) throw new HttpError(404, "Not found");
    await deletePerson(ownerId, personId);
    await putAudit(ownerId, "person.deleted", { personId });
    return json({ data: { deleted: true } });
  }, { sameOrigin: true });
}
