import "server-only";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requiredAwsResource, s3Client } from "./aws";
import type { StoredFile } from "@/types/domain";

export async function presignUpload(file: StoredFile): Promise<string> {
  return getSignedUrl(s3Client, new PutObjectCommand({
    Bucket: requiredAwsResource("SLEEVE_BUCKET_NAME"), Key: file.objectKey, ContentType: file.contentType,
    ServerSideEncryption: "aws:kms", SSEKMSKeyId: requiredAwsResource("SLEEVE_KMS_KEY_ARN"),
  }), { expiresIn: 300 });
}

export function uploadHeaders(file: StoredFile): Record<string, string> {
  return {
    "Content-Type": file.contentType,
    "x-amz-server-side-encryption": "aws:kms",
    "x-amz-server-side-encryption-aws-kms-key-id": requiredAwsResource("SLEEVE_KMS_KEY_ARN"),
  };
}

export async function presignDownload(file: StoredFile, expiresIn = 120): Promise<string> {
  return getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: requiredAwsResource("SLEEVE_BUCKET_NAME"), Key: file.objectKey,
    VersionId: file.versionId,
    ResponseContentType: file.contentType,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  }), { expiresIn });
}

export async function removeObject(file: StoredFile): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: requiredAwsResource("SLEEVE_BUCKET_NAME"), Key: file.objectKey }));
}

function matchesDeclaredType(bytes: Uint8Array, contentType: StoredFile["contentType"]): boolean {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (contentType === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  if (contentType === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  return false;
}

export async function verifyUploadedObject(file: StoredFile): Promise<string> {
  const result = await s3Client.send(new HeadObjectCommand({ Bucket: requiredAwsResource("SLEEVE_BUCKET_NAME"), Key: file.objectKey }));
  if (
    result.ContentLength !== file.size ||
    result.ContentType !== file.contentType ||
    result.ServerSideEncryption !== "aws:kms" ||
    result.SSEKMSKeyId !== requiredAwsResource("SLEEVE_KMS_KEY_ARN") ||
    !result.VersionId
  ) {
    throw new Error("Uploaded object does not match its authorization");
  }
  const sample = await s3Client.send(new GetObjectCommand({
    Bucket: requiredAwsResource("SLEEVE_BUCKET_NAME"),
    Key: file.objectKey,
    VersionId: result.VersionId,
    Range: "bytes=0-15",
  }));
  const bytes = await sample.Body?.transformToByteArray();
  if (!bytes || !matchesDeclaredType(bytes, file.contentType)) throw new Error("Uploaded file content does not match its declared type");
  return result.VersionId;
}
