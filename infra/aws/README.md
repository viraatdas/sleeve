# Sleeve AWS infrastructure

This template provisions the production data boundary in `us-west-2` without
containing credentials. It creates a private versioned S3 bucket, a
customer-managed KMS key, a DynamoDB single table, and a narrowly scoped role
that only Sleeve's selected Vercel project/environment can assume.

## Prerequisite: Vercel OIDC provider

The template deliberately accepts the existing account-level team provider ARN
instead of attempting to create a duplicate provider. Configure the team
issuer `https://oidc.vercel.com/viraatdas-projects` once in IAM with the
audience `https://vercel.com/viraatdas-projects`. Pass its ARN as
`VercelOidcProviderArn`. The role additionally checks the exact Vercel team,
project, and environment subject claims.

## Validate and deploy

Validation is local and does not need credentials:

```sh
cfn-lint infra/aws/sleeve.yaml
```

Deployment changes cloud state. Review the change set before executing it:

```sh
aws cloudformation deploy \
  --region us-west-2 \
  --stack-name sleeve-production \
  --template-file infra/aws/sleeve.yaml \
  --capabilities CAPABILITY_IAM \
  --no-execute-changeset \
  --parameter-overrides \
    VercelOidcProviderArn=arn:aws:iam::<account-id>:oidc-provider/oidc.vercel.com/viraatdas-projects \
    VercelTeamSlug=viraatdas-projects \
    VercelProjectName=sleeve \
    VercelEnvironment=production \
    AppOrigin=https://sleeve.viraat.dev
```

Inspect that change set, then repeat without `--no-execute-changeset` when it
is approved. Use the stack outputs as server-only Vercel environment values.
The application should use Vercel's AWS OIDC credentials provider with the
output role ARN; do not create long-lived IAM access keys.

## Data retention and recovery

- CloudFormation retains the bucket, KMS key, and table if the stack is
  deleted or replaced.
- DynamoDB point-in-time recovery and deletion protection are enabled.
- S3 noncurrent versions are retained for 90 days by default. Adjust
  `NoncurrentVersionRetentionDays` to match the approved retention policy
  before production use.
- All uploads must explicitly request SSE-KMS with the stack key ARN. Presigned
  PUTs must sign both encryption headers.

No stack output, application log, or deployment log should include document
contents, signed URLs, personal identifiers, or authentication tokens.
