import { requireSession } from "@/lib/auth";
import { handleApi, HttpError, json } from "@/lib/http";
import { putAudit, revokeShare } from "@/lib/repository";

export const runtime = "nodejs";
type Context = { params: Promise<{ shareId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  return handleApi(request, async () => {
    const { ownerId } = await requireSession();
    const { shareId } = await params;
    if (!await revokeShare(ownerId, shareId)) throw new HttpError(404, "Not found");
    await putAudit(ownerId, "share.revoked", { shareId });
    return json({ data: { revoked: true } });
  }, { sameOrigin: true });
}
