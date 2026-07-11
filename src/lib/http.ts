import { NextResponse } from "next/server";
import { withAwsRequest } from "./aws";
import { ValidationError } from "./validation";

export class HttpError extends Error {
  constructor(public status: number, public publicMessage: string) { super(publicMessage); }
}

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: privateHeaders });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if ((process.env.NODE_ENV === "production" || process.env.VERCEL === "1") && !configured) {
    throw new HttpError(503, "Application origin is not configured");
  }
  const allowedOrigin = configured ? new URL(configured).origin : new URL(request.url).origin;
  if (!origin || origin !== allowedOrigin) throw new HttpError(403, "Request not allowed");
}

export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type")?.split(";", 1)[0];
  if (type !== "application/json") throw new HttpError(415, "JSON required");
  try { return await request.json(); } catch { throw new ValidationError(); }
}

export async function handleApi(
  request: Request,
  operation: () => Promise<Response>,
  options: { sameOrigin?: boolean } = {},
): Promise<Response> {
  try {
    if (options.sameOrigin) assertSameOrigin(request);
    return await withAwsRequest(request, operation);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.publicMessage }, error.status);
    if (error instanceof ValidationError) return json({ error: "Invalid request" }, 400);
    if (error instanceof Error && error.message === "PERSON_NOT_EMPTY") return json({ error: "Remove this person's records first" }, 409);
    if (error instanceof Error && error.message === "RECORD_HAS_FILES") return json({ error: "Remove this record's files first" }, 409);
    return json({ error: "Unable to complete the request" }, 500);
  }
}
