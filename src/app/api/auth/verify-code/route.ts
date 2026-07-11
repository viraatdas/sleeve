import { POST as verifyCode } from "../verify/route";

export const runtime = "nodejs";

export function POST(request: Request) {
  return verifyCode(request);
}
