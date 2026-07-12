export type RecordCategory =
  | "Identity"
  | "Health"
  | "Vision"
  | "Insurance"
  | "Immigration";

export type RecordStatus = "protected" | "attention" | "complete";

export interface SleeveRecord {
  id: string;
  title: string;
  category: RecordCategory;
  subtitle: string;
  maskedNumber: string;
  expiryLabel?: string;
  reminderLabel?: string;
  status: RecordStatus;
  fields: Array<{ label: string; value: string; sensitive?: boolean }>;
  hasSource: boolean;
}

export type ApiRecordKind =
  | "medical"
  | "insurance"
  | "vision"
  | "passport"
  | "drivers_license"
  | "oci"
  | "green_card"
  | "other";

export interface ApiPerson {
  id: string;
  displayName: string;
  relationship?: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiExtractionResult {
  status: "review_required";
  fields: Array<{ label: string; value: string; confidence?: number }>;
  documentType?: string;
}

export interface ApiRecord {
  id: string;
  personId: string;
  kind: ApiRecordKind;
  title: string;
  issuer?: string;
  identifier?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
  reminderDaysBefore?: number;
  reminderEmails?: string[];
  extraction?: ApiExtractionResult;
  createdAt: string;
  updatedAt: string;
}

export interface ApiStoredFile {
  id: string;
  personId: string;
  recordId: string;
  fileName: string;
  contentType: string;
  size: number;
  status: "pending" | "uploaded";
  createdAt: string;
}

export interface CreateRecordInput {
  kind: ApiRecordKind;
  title: string;
  issuer?: string;
  identifier?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
  reminderDaysBefore?: number;
  reminderEmails?: string[];
}

export interface UpdateRecordInput extends Partial<CreateRecordInput> {
  extraction?: {
    fields: Array<{ label: string; value: string; confidence?: number }>;
    documentType?: string;
  };
}

export interface Person {
  id: string;
  name: string;
  relationship: string;
  initials: string;
}

export interface Reminder {
  id: string;
  recordTitle: string;
  personName: string;
  timing: string;
  recipientCount: number;
  urgent?: boolean;
}

export interface WorkspaceData {
  people: Person[];
  records: SleeveRecord[];
  reminders: Reminder[];
}

export interface SessionUser {
  email?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}
