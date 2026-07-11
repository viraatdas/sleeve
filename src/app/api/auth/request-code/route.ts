import { handleApi, json, readJson } from "@/lib/http";
import { requestLoginCode } from "@/lib/auth";
import { requestCodeSchema, safeJson } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const { email } = safeJson(requestCodeSchema, await readJson(request));
    await requestLoginCode(email);
    return json({ ok: true, data: { accepted: true } }, 202);
  }, { sameOrigin: true });
}
