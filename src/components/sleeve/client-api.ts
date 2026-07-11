import type {
  ApiExtractionResult,
  ApiPerson,
  ApiRecord,
  ApiRecordKind,
  ApiStoredFile,
  CreateRecordInput,
  Person,
  RecordCategory,
  SessionResponse,
  SleeveRecord,
} from "./types";

export class SleeveApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SleeveApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string; message?: string })
    | null;

  if (!response.ok) {
    throw new SleeveApiError(
      body?.error ?? body?.message ?? "That didn’t work. Try again.",
      response.status,
    );
  }

  return (body ?? {}) as T;
}

async function dataRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await request<{ data: T }>(path, init);
  return body.data;
}

function apiPath(personId: string, suffix = "") {
  return `/api/people/${encodeURIComponent(personId)}${suffix}`;
}

const categoryByKind: Record<ApiRecordKind, RecordCategory> = {
  medical: "Health",
  insurance: "Insurance",
  vision: "Vision",
  passport: "Identity",
  drivers_license: "Identity",
  oci: "Immigration",
  green_card: "Immigration",
  other: "Identity",
};

const kindLabels: Record<ApiRecordKind, string> = {
  medical: "Medical record",
  insurance: "Insurance policy",
  vision: "Vision record",
  passport: "Passport",
  drivers_license: "Driver license",
  oci: "OCI record",
  green_card: "Green card",
  other: "Personal record",
};

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "—";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00Z`));
}

function expiryPresentation(expiresOn?: string): Pick<SleeveRecord, "expiryLabel" | "status"> {
  if (!expiresOn) return { status: "protected" };
  const days = Math.ceil((new Date(`${expiresOn}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { expiryLabel: `Expired ${formatDate(expiresOn)}`, status: "attention" };
  if (days <= 90) return { expiryLabel: `Expires ${formatDate(expiresOn)}`, status: "attention" };
  return { expiryLabel: `Expires ${formatDate(expiresOn)}`, status: "complete" };
}

export function presentPerson(person: ApiPerson): Person {
  return {
    id: person.id,
    name: person.displayName,
    relationship: person.relationship ?? "Managed by you",
    initials: initialsFor(person.displayName),
  };
}

export function presentRecord(record: ApiRecord, hasSource = false): SleeveRecord {
  const fields: SleeveRecord["fields"] = [];
  if (record.issuer) fields.push({ label: "Issuer", value: record.issuer });
  if (record.identifier) fields.push({ label: "Identifier", value: record.identifier, sensitive: true });
  if (record.issuedOn) fields.push({ label: "Issued", value: formatDate(record.issuedOn) });
  if (record.expiresOn) fields.push({ label: "Expires", value: formatDate(record.expiresOn) });
  if (record.notes) fields.push({ label: "Notes", value: record.notes, sensitive: true });
  for (const field of record.extraction?.fields ?? []) {
    fields.push({ label: field.label, value: field.value, sensitive: true });
  }
  if (!fields.length) fields.push({ label: "Details", value: "No details saved yet" });
  const expiry = expiryPresentation(record.expiresOn);
  return {
    id: record.id,
    title: record.title,
    category: categoryByKind[record.kind],
    subtitle: record.issuer || kindLabels[record.kind],
    maskedNumber: record.identifier ? "•••• ••••" : "No number saved",
    ...expiry,
    reminderLabel: record.expiresOn
      ? record.reminderDaysBefore === undefined
        ? "Reminder set"
        : `${record.reminderDaysBefore}-day reminder`
      : "No reminder yet",
    fields,
    hasSource,
  };
}

interface UploadAuthorization {
  file: ApiStoredFile;
  uploadUrl: string;
  expiresInSeconds: number;
  uploadHeaders?: Record<string, string>;
}

export const recordKinds: Array<{ value: ApiRecordKind; label: string }> = [
  { value: "medical", label: "Medical" },
  { value: "insurance", label: "Insurance" },
  { value: "vision", label: "Vision" },
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver license" },
  { value: "oci", label: "OCI" },
  { value: "green_card", label: "Green card" },
  { value: "other", label: "Other" },
];

export const sleeveApi = {
  session: () => request<SessionResponse>("/api/auth/session", { method: "GET" }),
  requestCode: (email: string) =>
    request<{ ok: boolean }>("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  verifyCode: (email: string, code: string, remember: boolean) =>
    request<SessionResponse>("/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code, remember }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: "{}" }),
  people: () => dataRequest<ApiPerson[]>("/api/people", { method: "GET" }),
  createPerson: (displayName: string, relationship: string) =>
    dataRequest<ApiPerson>("/api/people", {
      method: "POST",
      body: JSON.stringify({ displayName, relationship }),
    }),
  records: (personId: string) =>
    dataRequest<ApiRecord[]>(apiPath(personId, "/records"), { method: "GET" }),
  files: (personId: string, recordId: string) =>
    dataRequest<ApiStoredFile[]>(apiPath(personId, `/records/${encodeURIComponent(recordId)}/files`), { method: "GET" }),
  createRecord: (personId: string, input: CreateRecordInput) =>
    dataRequest<ApiRecord>(apiPath(personId, "/records"), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  async uploadFile(personId: string, recordId: string, file: File) {
    const basePath = apiPath(personId, `/records/${encodeURIComponent(recordId)}`);
    const authorization = await dataRequest<UploadAuthorization>(`${basePath}/files`, {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
    });
    const headers = new Headers(authorization.uploadHeaders);
    headers.delete("content-length");
    headers.set("content-type", file.type);
    if (headers.get("x-amz-server-side-encryption") !== "aws:kms" || !headers.has("x-amz-server-side-encryption-aws-kms-key-id")) {
      throw new SleeveApiError("Secure upload authorization is incomplete. The record was saved without its source.", 500);
    }
    const upload = await fetch(authorization.uploadUrl, { method: "PUT", headers, body: file });
    if (!upload.ok) throw new SleeveApiError("The record was saved, but its source could not be uploaded securely.", upload.status);
    const completed = await dataRequest<ApiStoredFile>(`${basePath}/files/${encodeURIComponent(authorization.file.id)}`, {
      method: "PATCH",
      body: "{}",
    });
    return completed;
  },
  extract: (personId: string, recordId: string, fileId: string) =>
    dataRequest<ApiExtractionResult>(apiPath(personId, `/records/${encodeURIComponent(recordId)}/extract`), {
      method: "POST",
      body: JSON.stringify({ fileId }),
    }),
  createShare: (personId: string, recordId: string, expiresInMinutes: number, includeFiles: boolean) =>
    dataRequest<{ id: string; expiresAt: string; url: string }>(apiPath(personId, `/records/${encodeURIComponent(recordId)}/shares`), {
      method: "POST",
      body: JSON.stringify({ expiresInMinutes, includeFiles }),
    }),
};
