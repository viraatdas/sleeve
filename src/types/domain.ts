export const RECORD_KINDS = [
  "medical",
  "insurance",
  "vision",
  "passport",
  "drivers_license",
  "oci",
  "green_card",
  "other",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export interface Person {
  id: string;
  displayName: string;
  relationship?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SleeveRecord {
  id: string;
  personId: string;
  kind: RecordKind;
  title: string;
  issuer?: string;
  identifier?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
  reminderDaysBefore?: number;
  reminderEmails?: string[];
  extraction?: ExtractionResult;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFile {
  id: string;
  recordId: string;
  personId: string;
  fileName: string;
  contentType: string;
  size: number;
  objectKey: string;
  versionId?: string;
  status: "pending" | "uploaded";
  createdAt: string;
}

export interface ShareGrant {
  id: string;
  ownerId: string;
  personId: string;
  recordId: string;
  includeFiles: boolean;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

export interface ExtractionResult {
  status: "review_required";
  fields: Array<{ label: string; value: string; confidence?: number }>;
  documentType?: string;
}

export interface SessionIdentity {
  ownerId: string;
  email: string;
  expiresAt: string;
}
