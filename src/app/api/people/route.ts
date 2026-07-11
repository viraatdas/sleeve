import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth";
import { handleApi, json, readJson } from "@/lib/http";
import { listPeople, putAudit, putPerson } from "@/lib/repository";
import { personCreateSchema, safeJson } from "@/lib/validation";
import type { Person } from "@/types/domain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    return json({ data: await listPeople(ownerId) });
  });
}

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const input = safeJson(personCreateSchema, await readJson(request));
    const now = new Date().toISOString();
    const person: Person = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    await putPerson(ownerId, person, true);
    await putAudit(ownerId, "person.created", { personId: person.id });
    return json({ data: person }, 201);
  }, { sameOrigin: true });
}
