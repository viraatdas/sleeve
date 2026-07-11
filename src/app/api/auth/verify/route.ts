import { handleApi, json, readJson } from "@/lib/http";
import { sessionCookieName, verifyLoginCode } from "@/lib/auth";
import { safeJson, verifyCodeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApi(request, async () => {
    const input = safeJson(verifyCodeSchema, await readJson(request));
    const { token, identity, maxAge } = await verifyLoginCode(input.email, input.code, input.remember);
    const response = json({ authenticated: true, user: { email: identity.email }, data: identity });
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge,
    });
    return response;
  }, { sameOrigin: true });
}
