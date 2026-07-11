import "server-only";

import { Resend } from "resend";

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

function from(): string {
  return process.env.SLEEVE_FROM_EMAIL ?? "Sleeve <no-reply@sleeve.viraat.dev>";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const { error } = await client().emails.send({
    from: from(), to: email, subject: "Your Sleeve sign-in code",
    text: `Your Sleeve sign-in code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;color:#1f2421;line-height:1.6"><p>Your Sleeve sign-in code is:</p><p style="font-size:28px;letter-spacing:0.18em"><strong>${escapeHtml(code)}</strong></p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p></div>`,
  });
  if (error) throw new Error("Email delivery failed");
}

export async function sendExpiryReminder(recipients: string[], title: string, expiresOn: string): Promise<void> {
  void title;
  for (const recipient of recipients) {
    const { error } = await client().emails.send({
      from: from(), to: recipient, subject: "A Sleeve record needs attention",
      text: `A private record is due to expire on ${expiresOn}. Sign in to Sleeve to review it.`,
      html: `<div style="font-family:system-ui,sans-serif;color:#1f2421;line-height:1.6"><p>A private record is due to expire on <strong>${escapeHtml(expiresOn)}</strong>.</p><p>Sign in to Sleeve to review it.</p></div>`,
    });
    if (error) throw new Error("Reminder delivery failed");
  }
}
