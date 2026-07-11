import { safeEqual } from "@/lib/crypto";
import { sendExpiryReminder } from "@/lib/email";
import { handleApi, HttpError, json } from "@/lib/http";
import { claimReminder, getOwnerEmail, markReminderSent, putAudit, releaseReminderClaim, scanDueReminders } from "@/lib/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleApi(request, async () => {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!secret || !authorization || !safeEqual(authorization, `Bearer ${secret}`)) throw new HttpError(401, "Unauthorized");
    const today = new Date().toISOString().slice(0, 10);
    const due = await scanDueReminders(today);
    let sent = 0;
    let failed = 0;
    for (const { ownerId, record } of due) {
      if (!record.expiresOn || !await claimReminder(ownerId, record)) continue;
      try {
        const ownerEmail = await getOwnerEmail(ownerId);
        const recipients = Array.from(new Set([...(ownerEmail ? [ownerEmail] : []), ...(record.reminderEmails ?? [])]));
        if (!recipients.length) {
          await releaseReminderClaim(ownerId, record);
          continue;
        }
        await sendExpiryReminder(recipients, record.title, record.expiresOn);
        await markReminderSent(ownerId, record);
        await putAudit(ownerId, "reminder.sent", { personId: record.personId, recordId: record.id });
        sent += 1;
      } catch {
        failed += 1;
        await releaseReminderClaim(ownerId, record).catch(() => undefined);
      }
    }
    return json({ data: { processed: due.length, sent, failed } });
  });
}
