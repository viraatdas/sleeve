import { requireSession } from "@/lib/auth";
import { handleApi, json } from "@/lib/http";
import { listAudit } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    return json({ data: await listAudit(ownerId) });
  });
}
