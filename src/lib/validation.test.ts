import { describe, expect, it } from "vitest";
import { extractionResponseSchema, shareCreateSchema, uploadSchema, verifyCodeSchema } from "./validation";

describe("boundary validation", () => {
  it("normalizes authentication emails and rejects non-six-digit codes", () => {
    expect(verifyCodeSchema.parse({ email: " A@Example.com ", code: "123456" }).email).toBe("a@example.com");
    expect(verifyCodeSchema.safeParse({ email: "a@example.com", code: "12345" }).success).toBe(false);
  });

  it("limits private uploads to known types and 15 MB", () => {
    expect(uploadSchema.safeParse({ fileName: "record.pdf", contentType: "application/pdf", size: 100 }).success).toBe(true);
    expect(uploadSchema.safeParse({ fileName: "../record.pdf", contentType: "application/pdf", size: 100 }).success).toBe(false);
    expect(uploadSchema.safeParse({ fileName: "record.svg", contentType: "image/svg+xml", size: 100 }).success).toBe(false);
    expect(uploadSchema.safeParse({ fileName: "record.pdf", contentType: "application/pdf", size: 16 * 1024 * 1024 }).success).toBe(false);
  });

  it("defaults shares to fifteen minutes and caps custom duration", () => {
    expect(shareCreateSchema.parse({})).toMatchObject({ expiresInMinutes: 15, includeFiles: true });
    expect(shareCreateSchema.safeParse({ expiresInMinutes: 10081 }).success).toBe(false);
  });

  it("rejects oversized and malformed extraction output", () => {
    expect(extractionResponseSchema.safeParse({ fields: [{ label: "Number", value: "redacted", confidence: 0.9 }] }).success).toBe(true);
    expect(extractionResponseSchema.safeParse({ fields: [{ label: "Number", value: "redacted", confidence: 2 }] }).success).toBe(false);
  });
});
