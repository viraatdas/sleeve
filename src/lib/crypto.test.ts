import { describe, expect, it } from "vitest";
import { decryptJson, emailKey, encryptJson, hashToken, hmacValue, randomToken, safeEqual } from "./crypto";

const key = Buffer.alloc(32, 7).toString("base64");
const secret = "a".repeat(32);

describe("sensitive value crypto", () => {
  it("round trips encrypted JSON without exposing plaintext", () => {
    const encrypted = encryptJson({ identifier: "private-value" }, key);
    expect(encrypted).not.toContain("private-value");
    expect(decryptJson(encrypted, key)).toEqual({ identifier: "private-value" });
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptJson({ value: "private" }, key);
    const parts = encrypted.split(".");
    parts[3] = `${parts[3]?.startsWith("A") ? "B" : "A"}${parts[3]?.slice(1)}`;
    expect(() => decryptJson(parts.join("."), key)).toThrow();
  });

  it("creates opaque random tokens and stable one-way hashes", () => {
    const token = randomToken();
    expect(token).toHaveLength(43);
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(token);
  });

  it("uses keyed hashes for emails and codes", () => {
    expect(emailKey("Person@Example.com", secret)).toBe(emailKey("person@example.com", secret));
    expect(hmacValue("123456", secret)).not.toBe(hmacValue("123457", secret));
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "other")).toBe(false);
  });
});
