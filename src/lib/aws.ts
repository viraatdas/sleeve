import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { fromNodeProviderChain, fromWebToken } from "@aws-sdk/credential-providers";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AsyncLocalStorage } from "node:async_hooks";

const region = process.env.AWS_REGION ?? "us-west-2";

const oidcContext = new AsyncLocalStorage<string | undefined>();
const normalChain = fromNodeProviderChain({ clientConfig: { region } });
const awsCredentials = async () => {
  const roleArn = process.env.AWS_ROLE_ARN;
  // Vercel sends a fresh token per production request; local `vercel dev` uses the env value.
  const oidcToken = oidcContext.getStore() ?? process.env.VERCEL_OIDC_TOKEN;
  if (!roleArn || !oidcToken) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
      throw new Error("Vercel OIDC credentials are required in production");
    }
    return normalChain();
  }
  return fromWebToken({
    roleArn,
    webIdentityToken: oidcToken,
    roleSessionName: `sleeve-vercel-${process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 32) ?? "runtime"}`,
    clientConfig: { region },
  })();
};
const dynamoClient = new DynamoDBClient({ region, credentials: awsCredentials });

export const documentClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});
export const s3Client = new S3Client({
  region,
  credentials: awsCredentials,
  requestChecksumCalculation: "WHEN_REQUIRED",
});
export const awsRegion = region;

export function withAwsRequest<T>(request: Request, operation: () => Promise<T>): Promise<T> {
  return oidcContext.run(request.headers.get("x-vercel-oidc-token") ?? undefined, operation);
}

export function requiredAwsResource(name: "SLEEVE_TABLE_NAME" | "SLEEVE_BUCKET_NAME" | "SLEEVE_KMS_KEY_ARN"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
