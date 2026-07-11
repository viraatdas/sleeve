import type { WorkspaceData } from "./types";

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

