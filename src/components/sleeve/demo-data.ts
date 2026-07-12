import type { ApiRecordKind, WorkspaceData } from "./types";

/** Fictional extraction drafts so the demo can exercise the review step. */
export function demoExtractionFields(kind: ApiRecordKind): Array<{ label: string; value: string; confidence?: number }> {
  if (kind === "insurance") {
    return [
      { label: "Member ID", value: "DEMO-4821-XX", confidence: 0.94 },
      { label: "Group number", value: "GRP-00000", confidence: 0.9 },
      { label: "Plan", value: "Example Care Plus", confidence: 0.97 },
      { label: "Effective date", value: "2026-01-01", confidence: 0.71 },
      { label: "Customer service", value: "1-800-000-0000", confidence: 0.52 },
    ];
  }
  if (kind === "medical" || kind === "vision") {
    return [
      { label: "Patient", value: "Demo person", confidence: 0.95 },
      { label: "Provider", value: "Example practice", confidence: 0.9 },
      { label: "Date", value: "2026-05-01", confidence: 0.83 },
      { label: "Notes", value: "Demo value", confidence: 0.58 },
    ];
  }
  return [
    { label: "Document number", value: "DEMO000000", confidence: 0.96 },
    { label: "Full name", value: "Demo person", confidence: 0.92 },
    { label: "Issued on", value: "2020-06-15", confidence: 0.88 },
    { label: "Expires on", value: "2030-06-14", confidence: 0.86 },
    { label: "Place of issue", value: "Example city", confidence: 0.57 },
  ];
}

/**
 * Local development metadata only. These are intentionally fictional and are
 * never used unless the dev/demo preview is explicitly enabled.
 */
export const demoWorkspace: WorkspaceData = {
  people: [
    { id: "demo-you", name: "You", relationship: "Owner", initials: "YO" },
    { id: "demo-family", name: "Family member", relationship: "Managed by you", initials: "FM" },
  ],
  records: [
    {
      id: "demo-vision",
      title: "Vision prescription",
      category: "Vision",
      subtitle: "Example optometry practice",
      maskedNumber: "•••• ••••",
      expiryLabel: "Renews in 7 months",
      reminderLabel: "Reminder set",
      status: "protected",
      hasSource: true,
      fields: [
        { label: "Right eye", value: "Demo value", sensitive: true },
        { label: "Left eye", value: "Demo value", sensitive: true },
        { label: "Exam date", value: "Example date" },
      ],
    },
    {
      id: "demo-passport",
      title: "Passport",
      category: "Identity",
      subtitle: "Identity document",
      maskedNumber: "•••• ••••",
      expiryLabel: "Review in 11 months",
      reminderLabel: "2 recipients",
      status: "attention",
      hasSource: true,
      fields: [
        { label: "Document number", value: "Demo number", sensitive: true },
        { label: "Nationality", value: "Demo value", sensitive: true },
        { label: "Expires", value: "Example date" },
      ],
    },
    {
      id: "demo-insurance",
      title: "Health insurance",
      category: "Insurance",
      subtitle: "Example health plan",
      maskedNumber: "•••• ••••",
      reminderLabel: "Checked recently",
      status: "complete",
      hasSource: true,
      fields: [
        { label: "Member ID", value: "Demo number", sensitive: true },
        { label: "Group", value: "Demo group", sensitive: true },
        { label: "Support", value: "Available on source" },
      ],
    },
    {
      id: "demo-oci",
      title: "OCI card",
      category: "Immigration",
      subtitle: "Immigration record",
      maskedNumber: "•••• ••••",
      reminderLabel: "No deadline",
      status: "protected",
      hasSource: false,
      fields: [
        { label: "File number", value: "Demo number", sensitive: true },
        { label: "Issued", value: "Example date" },
        { label: "Source", value: "Not uploaded" },
      ],
    },
    {
      id: "demo-drivers-license",
      title: "Driver license",
      category: "Identity",
      subtitle: "Identity document",
      maskedNumber: "•••• ••••",
      expiryLabel: "Current",
      reminderLabel: "Reminder set",
      status: "complete",
      hasSource: true,
      fields: [
        { label: "License number", value: "Demo number", sensitive: true },
        { label: "Class", value: "Demo value", sensitive: true },
        { label: "Expires", value: "Example date" },
      ],
    },
  ],
  reminders: [
    {
      id: "demo-reminder-passport",
      recordTitle: "Passport",
      personName: "You",
      timing: "11 months before expiry",
      recipientCount: 2,
      urgent: true,
    },
    {
      id: "demo-reminder-vision",
      recordTitle: "Vision prescription",
      personName: "You",
      timing: "30 days before renewal",
      recipientCount: 1,
    },
  ],
};

