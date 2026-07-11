import "server-only";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { documentClient, requiredAwsResource } from "./aws";
import { decryptJson, encryptJson, hashToken } from "./crypto";
import type { Person, ShareGrant, SleeveRecord, StoredFile } from "@/types/domain";

type Item = Record<string, unknown> & { PK: string; SK: string };
const tableName = () => requiredAwsResource("SLEEVE_TABLE_NAME");
const ownerPk = (ownerId: string) => `OWNER#${ownerId}`;

async function getItem(PK: string, SK: string): Promise<Item | undefined> {
  const result = await documentClient.send(new GetCommand({ TableName: tableName(), Key: { PK, SK }, ConsistentRead: true }));
  return result.Item as Item | undefined;
}

export interface OtpItem extends Item {
  codeHash: string;
  encryptedEmail: string;
  expiresAt: number;
  attempts: number;
  sendCount: number;
  rateWindowStart: number;
  lastSentAt: number;
  version: string;
  consumedAt?: number;
}

type OtpPayload = Pick<OtpItem, "codeHash" | "encryptedEmail" | "expiresAt" | "attempts" | "sendCount" | "rateWindowStart" | "lastSentAt" | "version">;

export async function getOtp(emailHash: string): Promise<OtpItem | undefined> {
  return (await getItem(`OTP#${emailHash}`, "META")) as OtpItem | undefined;
}

export async function putOtp(emailHash: string, next: OtpPayload, priorVersion?: string): Promise<void> {
  await documentClient.send(new PutCommand({
    TableName: tableName(),
    Item: { PK: `OTP#${emailHash}`, SK: "META", entityType: "OTP", ...next, ttl: next.expiresAt + 3600 },
    ConditionExpression: priorVersion ? "#version = :prior" : "attribute_not_exists(PK)",
    ExpressionAttributeNames: priorVersion ? { "#version": "version" } : undefined,
    ExpressionAttributeValues: priorVersion ? { ":prior": priorVersion } : undefined,
  }));
}

export async function failOtpAttempt(emailHash: string, version: string, now: number): Promise<void> {
  await documentClient.send(new UpdateCommand({
    TableName: tableName(), Key: { PK: `OTP#${emailHash}`, SK: "META" },
    UpdateExpression: "SET attempts = attempts + :one",
    ConditionExpression: "#version = :version AND attempts < :limit AND expiresAt > :now AND attribute_not_exists(consumedAt)",
    ExpressionAttributeNames: { "#version": "version" },
    ExpressionAttributeValues: { ":one": 1, ":version": version, ":limit": 5, ":now": now },
  }));
}

export async function consumeOtp(emailHash: string, version: string, now: number): Promise<void> {
  await documentClient.send(new UpdateCommand({
    TableName: tableName(), Key: { PK: `OTP#${emailHash}`, SK: "META" },
    UpdateExpression: "SET consumedAt = :now",
    ConditionExpression: "#version = :version AND attempts < :limit AND expiresAt > :now AND attribute_not_exists(consumedAt)",
    ExpressionAttributeNames: { "#version": "version" },
    ExpressionAttributeValues: { ":version": version, ":limit": 5, ":now": now },
  }));
}

interface OwnerLookup extends Item { ownerId: string; encryptedEmail: string }

export async function getOwnerByEmailHash(emailHash: string): Promise<OwnerLookup | undefined> {
  return (await getItem(`EMAIL#${emailHash}`, "OWNER")) as OwnerLookup | undefined;
}

export async function createOwner(emailHash: string, encryptedEmail: string): Promise<string> {
  const ownerId = randomUUID();
  const now = new Date().toISOString();
  await documentClient.send(new TransactWriteCommand({ TransactItems: [
    { Put: { TableName: tableName(), Item: { PK: `EMAIL#${emailHash}`, SK: "OWNER", entityType: "EMAIL_LOOKUP", ownerId, encryptedEmail }, ConditionExpression: "attribute_not_exists(PK)" } },
    { Put: { TableName: tableName(), Item: { PK: ownerPk(ownerId), SK: "PROFILE", entityType: "OWNER", encryptedEmail, createdAt: now }, ConditionExpression: "attribute_not_exists(PK)" } },
  ] }));
  return ownerId;
}

export async function getOwnerEmail(ownerId: string): Promise<string | undefined> {
  const item = await getItem(ownerPk(ownerId), "PROFILE");
  return typeof item?.encryptedEmail === "string" ? decryptJson<string>(item.encryptedEmail) : undefined;
}

export async function putSession(sessionHash: string, ownerId: string, encryptedEmail: string, expiresAt: number): Promise<void> {
  await documentClient.send(new PutCommand({ TableName: tableName(), Item: {
    PK: `SESSION#${sessionHash}`, SK: "META", entityType: "SESSION", ownerId, encryptedEmail, expiresAt, ttl: expiresAt,
  } }));
}

export async function getSession(sessionHash: string): Promise<{ ownerId: string; email: string; expiresAt: number } | undefined> {
  const item = await getItem(`SESSION#${sessionHash}`, "META");
  if (!item || typeof item.ownerId !== "string" || typeof item.encryptedEmail !== "string" || typeof item.expiresAt !== "number") return;
  return { ownerId: item.ownerId, email: decryptJson<string>(item.encryptedEmail), expiresAt: item.expiresAt };
}

export async function deleteSession(sessionHash: string): Promise<void> {
  await documentClient.send(new DeleteCommand({ TableName: tableName(), Key: { PK: `SESSION#${sessionHash}`, SK: "META" } }));
}

export async function listPeople(ownerId: string): Promise<Person[]> {
  const result = await documentClient.send(new QueryCommand({
    TableName: tableName(), KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": ownerPk(ownerId), ":prefix": "PERSON#" }, ConsistentRead: true,
  }));
  return (result.Items ?? []).filter((item) => !String(item.SK).includes("#RECORD#") && !String(item.SK).includes("#FILE#"))
    .map((item) => decryptJson<Person>(String(item.encrypted)));
}

export async function getPerson(ownerId: string, personId: string): Promise<Person | undefined> {
  const item = await getItem(ownerPk(ownerId), `PERSON#${personId}`);
  return typeof item?.encrypted === "string" ? decryptJson<Person>(item.encrypted) : undefined;
}

export async function putPerson(ownerId: string, person: Person, create = false): Promise<void> {
  await documentClient.send(new PutCommand({ TableName: tableName(), Item: {
    PK: ownerPk(ownerId), SK: `PERSON#${person.id}`, entityType: "PERSON", personId: person.id, encrypted: encryptJson(person), updatedAt: person.updatedAt,
  }, ...(create ? { ConditionExpression: "attribute_not_exists(PK)" } : { ConditionExpression: "attribute_exists(PK)" }) }));
}

export async function deletePerson(ownerId: string, personId: string): Promise<void> {
  const records = await listRecords(ownerId, personId);
  if (records.length) throw new Error("PERSON_NOT_EMPTY");
  await documentClient.send(new DeleteCommand({ TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${personId}` }, ConditionExpression: "attribute_exists(PK)" }));
}

export async function listRecords(ownerId: string, personId: string): Promise<SleeveRecord[]> {
  const result = await documentClient.send(new QueryCommand({
    TableName: tableName(), KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": ownerPk(ownerId), ":prefix": `PERSON#${personId}#RECORD#` }, ConsistentRead: true,
  }));
  return (result.Items ?? []).filter((item) => !String(item.SK).includes("#FILE#"))
    .map((item) => decryptJson<SleeveRecord>(String(item.encrypted)));
}

export async function getRecord(ownerId: string, personId: string, recordId: string): Promise<SleeveRecord | undefined> {
  const item = await getItem(ownerPk(ownerId), `PERSON#${personId}#RECORD#${recordId}`);
  return typeof item?.encrypted === "string" ? decryptJson<SleeveRecord>(item.encrypted) : undefined;
}

export async function putRecord(ownerId: string, record: SleeveRecord, create = false): Promise<void> {
  await documentClient.send(new PutCommand({ TableName: tableName(), Item: {
    PK: ownerPk(ownerId), SK: `PERSON#${record.personId}#RECORD#${record.id}`, entityType: "RECORD", ownerId,
    personId: record.personId, recordId: record.id,
    encrypted: encryptJson(record), updatedAt: record.updatedAt,
  }, ...(create ? { ConditionExpression: "attribute_not_exists(PK)" } : { ConditionExpression: "attribute_exists(PK)" }) }));
}

export async function deleteRecord(ownerId: string, personId: string, recordId: string): Promise<void> {
  const files = await listFiles(ownerId, personId, recordId);
  if (files.length) throw new Error("RECORD_HAS_FILES");
  await documentClient.send(new DeleteCommand({ TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${personId}#RECORD#${recordId}` }, ConditionExpression: "attribute_exists(PK)" }));
}

export async function putFile(ownerId: string, file: StoredFile): Promise<void> {
  await documentClient.send(new PutCommand({ TableName: tableName(), Item: {
    PK: ownerPk(ownerId), SK: `PERSON#${file.personId}#RECORD#${file.recordId}#FILE#${file.id}`, entityType: "FILE",
    personId: file.personId, recordId: file.recordId, fileId: file.id, encrypted: encryptJson(file),
  }, ConditionExpression: "attribute_not_exists(PK)" }));
}

export async function getFile(ownerId: string, personId: string, recordId: string, fileId: string): Promise<StoredFile | undefined> {
  const item = await getItem(ownerPk(ownerId), `PERSON#${personId}#RECORD#${recordId}#FILE#${fileId}`);
  return typeof item?.encrypted === "string" ? decryptJson<StoredFile>(item.encrypted) : undefined;
}

export async function updateFile(ownerId: string, file: StoredFile): Promise<void> {
  await documentClient.send(new UpdateCommand({
    TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${file.personId}#RECORD#${file.recordId}#FILE#${file.id}` },
    UpdateExpression: "SET encrypted = :encrypted", ConditionExpression: "attribute_exists(PK)",
    ExpressionAttributeValues: { ":encrypted": encryptJson(file) },
  }));
}

export async function listFiles(ownerId: string, personId: string, recordId: string): Promise<StoredFile[]> {
  const result = await documentClient.send(new QueryCommand({
    TableName: tableName(), KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": ownerPk(ownerId), ":prefix": `PERSON#${personId}#RECORD#${recordId}#FILE#` }, ConsistentRead: true,
  }));
  return (result.Items ?? []).map((item) => decryptJson<StoredFile>(String(item.encrypted)));
}

export async function deleteFile(ownerId: string, personId: string, recordId: string, fileId: string): Promise<void> {
  await documentClient.send(new DeleteCommand({
    TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${personId}#RECORD#${recordId}#FILE#${fileId}` },
    ConditionExpression: "attribute_exists(PK)",
  }));
}

export async function putShare(ownerId: string, share: ShareGrant, tokenHash: string): Promise<void> {
  const encrypted = encryptJson(share);
  const ttl = Math.floor(new Date(share.expiresAt).getTime() / 1000);
  await documentClient.send(new TransactWriteCommand({ TransactItems: [
    { Put: { TableName: tableName(), Item: { PK: ownerPk(ownerId), SK: `SHARE#${share.id}`, entityType: "SHARE", tokenHash, encrypted, expiresAt: ttl, ttl }, ConditionExpression: "attribute_not_exists(PK)" } },
    { Put: { TableName: tableName(), Item: { PK: `SHARE#${tokenHash}`, SK: "META", entityType: "SHARE_LOOKUP", ownerId, shareId: share.id, encrypted, expiresAt: ttl, ttl }, ConditionExpression: "attribute_not_exists(PK)" } },
  ] }));
}

export async function listSharesForRecord(ownerId: string, personId: string, recordId: string): Promise<ShareGrant[]> {
  const result = await documentClient.send(new QueryCommand({
    TableName: tableName(), KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": ownerPk(ownerId), ":prefix": "SHARE#" }, ConsistentRead: true,
  }));
  return (result.Items ?? []).flatMap((item) => {
    if (typeof item.encrypted !== "string") return [];
    const share = decryptJson<ShareGrant>(item.encrypted);
    return share.personId === personId && share.recordId === recordId ? [share] : [];
  });
}

export async function getShareByToken(token: string): Promise<ShareGrant | undefined> {
  const item = await getItem(`SHARE#${hashToken(token)}`, "META");
  return typeof item?.encrypted === "string" ? decryptJson<ShareGrant>(item.encrypted) : undefined;
}

export async function revokeShare(ownerId: string, shareId: string): Promise<boolean> {
  const ownerItem = await getItem(ownerPk(ownerId), `SHARE#${shareId}`);
  if (!ownerItem || typeof ownerItem.encrypted !== "string" || typeof ownerItem.tokenHash !== "string") return false;
  const share = decryptJson<ShareGrant>(ownerItem.encrypted);
  const revoked = { ...share, revokedAt: new Date().toISOString() };
  const encrypted = encryptJson(revoked);
  await documentClient.send(new TransactWriteCommand({ TransactItems: [
    { Update: { TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `SHARE#${shareId}` }, UpdateExpression: "SET encrypted = :encrypted", ConditionExpression: "attribute_exists(PK)", ExpressionAttributeValues: { ":encrypted": encrypted } } },
    { Update: { TableName: tableName(), Key: { PK: `SHARE#${ownerItem.tokenHash}`, SK: "META" }, UpdateExpression: "SET encrypted = :encrypted", ConditionExpression: "attribute_exists(PK)", ExpressionAttributeValues: { ":encrypted": encrypted } } },
  ] }));
  return true;
}

export async function putAudit(ownerId: string, action: string, details: Record<string, string> = {}): Promise<void> {
  const occurredAt = new Date().toISOString();
  const id = randomUUID();
  await documentClient.send(new PutCommand({ TableName: tableName(), Item: {
    PK: ownerPk(ownerId), SK: `AUDIT#${occurredAt}#${id}`, entityType: "AUDIT", action, occurredAt, details,
  } }));
}

export async function listAudit(ownerId: string, limit = 50): Promise<Array<{ action: string; occurredAt: string; details: Record<string, string> }>> {
  const result = await documentClient.send(new QueryCommand({
    TableName: tableName(), KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": ownerPk(ownerId), ":prefix": "AUDIT#" },
    ScanIndexForward: false, Limit: Math.min(limit, 100), ConsistentRead: true,
  }));
  return (result.Items ?? []).map((item) => ({
    action: String(item.action), occurredAt: String(item.occurredAt), details: (item.details ?? {}) as Record<string, string>,
  }));
}

export interface DueReminder { ownerId: string; record: SleeveRecord }

export async function scanDueReminders(today: string): Promise<DueReminder[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await documentClient.send(new ScanCommand({
      TableName: tableName(),
      FilterExpression: "entityType = :record",
      ExpressionAttributeValues: { ":record": "RECORD" },
      ExclusiveStartKey: cursor,
    }));
    items.push(...(result.Items ?? []));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  const now = new Date(`${today}T00:00:00.000Z`).getTime();
  return items.flatMap((item) => {
    if (typeof item.ownerId !== "string" || typeof item.encrypted !== "string") return [];
    const record = decryptJson<SleeveRecord>(item.encrypted);
    if (!record.expiresOn || record.reminderDaysBefore === undefined) return [];
    const dueAt = new Date(`${record.expiresOn}T00:00:00.000Z`).getTime() - record.reminderDaysBefore * 86_400_000;
    const sentFor = typeof item.reminderSentFor === "string" ? item.reminderSentFor : undefined;
    return dueAt <= now && sentFor !== hashToken(record.expiresOn) ? [{ ownerId: item.ownerId, record }] : [];
  });
}

export async function claimReminder(ownerId: string, record: SleeveRecord, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const reminderHash = hashToken(record.expiresOn ?? "");
  try {
    await documentClient.send(new UpdateCommand({
      TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${record.personId}#RECORD#${record.id}` },
      UpdateExpression: "SET reminderClaimFor = :claim, reminderClaimedAt = :now",
      ConditionExpression: "attribute_exists(PK) AND (attribute_not_exists(reminderSentFor) OR reminderSentFor <> :claim) AND (attribute_not_exists(reminderClaimedAt) OR reminderClaimedAt < :stale)",
      ExpressionAttributeValues: { ":claim": reminderHash, ":now": now, ":stale": now - 3600 },
    }));
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}

export async function markReminderSent(ownerId: string, record: SleeveRecord): Promise<void> {
  const reminderHash = hashToken(record.expiresOn ?? "");
  await documentClient.send(new UpdateCommand({
    TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${record.personId}#RECORD#${record.id}` },
    UpdateExpression: "SET reminderSentFor = :claim REMOVE reminderClaimFor, reminderClaimedAt",
    ConditionExpression: "attribute_exists(PK) AND reminderClaimFor = :claim",
    ExpressionAttributeValues: { ":claim": reminderHash },
  }));
}

export async function releaseReminderClaim(ownerId: string, record: SleeveRecord): Promise<void> {
  await documentClient.send(new UpdateCommand({
    TableName: tableName(), Key: { PK: ownerPk(ownerId), SK: `PERSON#${record.personId}#RECORD#${record.id}` },
    UpdateExpression: "REMOVE reminderClaimFor, reminderClaimedAt",
    ConditionExpression: "attribute_exists(PK) AND reminderClaimFor = :claim",
    ExpressionAttributeValues: { ":claim": hashToken(record.expiresOn ?? "") },
  }));
}
