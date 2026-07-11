import { revokeCurrentSession, sessionCookieName } from "@/lib/auth";
import { handleApi, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApi(request, async () => {
    await revokeCurrentSession();
    const response = json({ ok: true, data: { signedOut: true } });
    response.cookies.set(sessionCookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }, { sameOrigin: true });
}
