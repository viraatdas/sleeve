import { z } from "zod";
import { RECORD_KINDS } from "@/types/domain";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const requestCodeSchema = z.object({ email });
export const verifyCodeSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/),
  remember: z.boolean().default(true),
});

export const personCreateSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  relationship: z.string().trim().min(1).max(60).optional(),
  dateOfBirth: isoDate,
});
export const personUpdateSchema = personCreateSchema.partial().refine((value) => Object.keys(value).length > 0);

export const recordCreateSchema = z.object({
  kind: z.enum(RECORD_KINDS),
  title: z.string().trim().min(1).max(140),
  issuer: z.string().trim().max(140).optional(),
  identifier: z.string().trim().max(200).optional(),
  issuedOn: isoDate,
  expiresOn: isoDate,
  notes: z.string().trim().max(5000).optional(),
  reminderDaysBefore: z.number().int().min(0).max(730).optional(),
  reminderEmails: z.array(email).max(10).optional(),
});
const storedExtractionSchema = z.object({
  status: z.literal("review_required").default("review_required"),
  fields: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    value: z.string().trim().max(2000),
    confidence: z.number().min(0).max(1).optional(),
  })).max(100),
  documentType: z.string().trim().max(100).optional(),
});

export const recordUpdateSchema = recordCreateSchema
  .extend({ extraction: storedExtractionSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180).refine((value) => !/[\\/\0]/.test(value)),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  size: z.number().int().positive().max(15 * 1024 * 1024),
});

export const shareCreateSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(7 * 24 * 60).default(15),
  includeFiles: z.boolean().default(true),
});

export const extractionResponseSchema = z.object({
  fields: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    value: z.string().trim().max(2000),
    confidence: z.number().min(0).max(1).optional(),
  })).max(100),
  documentType: z.string().trim().max(100).optional(),
});

export function safeJson<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError();
  return parsed.data;
}

export class ValidationError extends Error {
  constructor() {
    super("Invalid request");
    this.name = "ValidationError";
  }
}
