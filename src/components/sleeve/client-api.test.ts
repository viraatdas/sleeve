import { afterEach, describe, expect, it, vi } from "vitest";
import { presentRecord, sleeveApi } from "./client-api";
import type { ApiRecord } from "./types";

const record: ApiRecord = {
  id: "record-id",
  personId: "person-id",
  kind: "passport",
  title: "Passport",
  identifier: "PRIVATE-IDENTIFIER",
  expiresOn: "2030-01-02",
  reminderDaysBefore: 30,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => vi.restoreAllMocks());

describe("production record presentation", () => {
  it("conceals identifiers on the summary while retaining a revealable field", () => {
    const presented = presentRecord(record);
    expect(presented.maskedNumber).toBe("•••• ••••");
    expect(presented.maskedNumber).not.toContain(record.identifier);
    expect(presented.fields).toContainEqual({
      label: "Identifier",
      value: record.identifier,
      sensitive: true,
    });
  });
});

describe("secure browser upload", () => {
  it("uses the server-provided signed headers and confirms the upload", async () => {
    const uploadHeaders = {
      "Content-Type": "image/png",
      "x-amz-server-side-encryption": "aws:kms",
      "x-amz-server-side-encryption-aws-kms-key-id": "test-kms-key",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        file: { id: "file-id", personId: "person-id", recordId: "record-id", fileName: "scan.png", contentType: "image/png", size: 4, status: "pending", createdAt: "now" },
        uploadUrl: "https://uploads.example.test/private",
        uploadHeaders,
        expiresInSeconds: 300,
      } }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: "file-id", personId: "person-id", recordId: "record-id", fileName: "scan.png", contentType: "image/png", size: 4, status: "uploaded", createdAt: "now",
      } }), { status: 200, headers: { "content-type": "application/json" } }));

    const file = new File(["scan"], "scan.png", { type: "image/png" });
    await sleeveApi.uploadFile("person-id", "record-id", file);

    const uploadInit = fetchMock.mock.calls[1]?.[1];
    const headers = new Headers(uploadInit?.headers);
    expect(headers.get("content-type")).toBe("image/png");
    expect(headers.get("x-amz-server-side-encryption")).toBe("aws:kms");
    expect(headers.get("x-amz-server-side-encryption-aws-kms-key-id")).toBe("test-kms-key");
    expect(headers.has("content-length")).toBe(false);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/people/person-id/records/record-id/files/file-id");
  });
});
