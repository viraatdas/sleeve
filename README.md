# Sleeve

Sleeve is a private, mobile-first home for identity, immigration, insurance, vision, and medical records. It supports multiple people, encrypted file storage, expiring share links, renewal reminders, and document extraction through a separately deployed Modal worker.

The implementation is a Next.js application deployed on Vercel. Product intent and visual decisions live in `PRODUCT.md` and `DESIGN.md`; the threat model and operational rules live in `SECURITY.md`.

## Local development

Requires Node.js 22+ and pnpm 10.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Set `NEXT_PUBLIC_ENABLE_DEMO=true` only for local visual development. It is ignored outside the Next.js development environment. Run `pnpm verify` before deployment.

## Architecture

- **App:** Next.js 16 on Vercel, with server route handlers and a mobile-first React interface.
- **Authentication:** Resend-delivered one-time codes, hash-only sessions, owner-email allowlisting, and secure remembered-device cookies.
- **Records:** A KMS-encrypted DynamoDB single table in `us-west-2`; sensitive payloads receive an additional AES-256-GCM application-encryption layer.
- **Files:** Private, versioned S3 objects with Block Public Access, TLS enforcement, SSE-KMS, short-lived signed operations, file-signature checks, and version-pinned downloads.
- **Extraction:** Self-hosted GLM-OCR on Modal L4 capacity in `us-west`, behind a lightweight authenticated CPU gateway. Extracted fields always require human review.
- **Sharing:** Record-scoped bearer links expire after 15 minutes by default. The bearer remains in the URL fragment and then in memory only, keeping it out of HTTP access logs.
- **Reminders:** A daily Vercel Cron invokes an authenticated, idempotent reminder worker. Additional recipients receive separate privacy-preserving messages.

## Production resources

AWS resources are declared in `infra/aws/sleeve.yaml`; Modal code lives in `modal/`. See each directory's README for validation and deployment commands. Production uses Vercel team OIDC to assume the generated AWS role—no static AWS keys are stored on Vercel.

Required server variables are documented in `.env.example`. Configure them through `vercel env add`, keep them production-scoped, and never use `NEXT_PUBLIC_` for secrets. The current production account is intentionally restricted with `SLEEVE_ALLOWED_EMAILS`; additional managed people are created inside that authenticated account.

## Verification

```bash
pnpm verify
uvx cfn-lint infra/aws/sleeve.yaml
cd modal && uv run pytest
```

Security behavior and incident handling are documented in `SECURITY.md`.
