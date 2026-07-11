import { currentSession } from "@/lib/auth";
import { handleApi, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const session = await currentSession();
    return json({ authenticated: Boolean(session), ...(session ? { user: { email: session.email } } : {}), data: session ?? null });
  });
}
