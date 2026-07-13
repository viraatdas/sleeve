import "server-only";

import { z } from "zod";
import type { ExtractionResult } from "@/types/domain";

const modalResponseSchema = z.object({
  document_type: z.string().max(100),
  requires_human_confirmation: z.literal(true),
  fields: z.record(z.string(), z.unknown()),
});

function flattenFields(value: unknown, path = "", output: Array<{ label: string; value: string }> = []) {
  if (value === null || value === undefined || value === "") return output;
  if (typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flattenFields(child, path ? `${path}.${key}` : key, output);
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => flattenFields(child, `${path}.${index + 1}`, output));
  } else {
    output.push({ label: path.replaceAll("_", " "), value: String(value).slice(0, 2000) });
  }
  return output;
}

export async function extractDocument(downloadUrl: string, contentType: string, documentType: string): Promise<ExtractionResult> {
  const endpoint = process.env.MODAL_EXTRACT_URL;
  const secret = process.env.MODAL_SHARED_SECRET;
  if (!endpoint || !secret) throw new Error("Modal extraction is not configured");
  if (!contentType.startsWith("image/")) throw new Error("Extraction requires an image");
  const source = await fetch(downloadUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!source.ok) throw new Error("Unable to read the private document");
  const bytes = Buffer.from(await source.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Document is too large for extraction");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ document_type: documentType, mime_type: contentType, image_base64: bytes.toString("base64") }),
    cache: "no-store", signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) throw new Error(`Extraction failed (upstream status ${response.status})`);
  const parsed = modalResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Extraction returned invalid data");
  return { status: "review_required", documentType: parsed.data.document_type, fields: flattenFields(parsed.data.fields).slice(0, 100) };
}
