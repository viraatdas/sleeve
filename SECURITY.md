# Sleeve security model

Sleeve handles identity, health, immigration, and insurance information. Treat every uploaded byte and extracted field as highly sensitive.

## Guarantees in the application boundary

- Authentication uses short-lived email codes. Codes are HMAC-hashed at rest, expire after ten minutes, are single-use, and have attempt and send-rate limits.
- Production sign-up is restricted by `SLEEVE_ALLOWED_EMAILS`; managed family members are data workspaces, not independent account principals.
- Remembered sessions use 256-bit random bearer tokens stored only in `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Only a hash of each token is stored in DynamoDB.
- Every person, record, file, reminder, and audit query is scoped to the authenticated owner. Public access exists only through a record-scoped share token.
- Share tokens are random, stored as hashes, revocable, and expire after 15 minutes by default. File URLs issued from a valid share expire sooner than the share itself.
- Sensitive record fields are encrypted with AES-256-GCM before DynamoDB storage. The table also uses AWS-managed encryption at rest.
- Files live in a private S3 bucket with Block Public Access, versioning, TLS-only access, and SSE-KMS. Upload and download URLs are short-lived and bound to one object.
- Completed uploads are size/type/signature checked and downloads are pinned to the accepted S3 version so a still-live upload URL cannot replace a confirmed document.
- Document extraction runs in a separately authenticated Modal service. Its output is untrusted, schema-validated, and requires human confirmation.
- Responses set a restrictive Content Security Policy, HSTS in production, `no-store` cache behavior for authenticated/private routes, and anti-framing/sniffing/referrer headers.
- Logs and analytics must never contain document bytes, field values, raw email codes, session/share tokens, signed URLs, or full personal identifiers.

## Infrastructure boundary

Production should use Vercel OIDC to assume a dedicated least-privilege AWS role. Static AWS keys are a temporary bootstrap mechanism only. The app role should access only the Sleeve DynamoDB table, Sleeve S3 bucket prefix, and Sleeve KMS key.

Modal and Resend credentials are server-only Vercel environment variables. They are not available to browser code. Production resources should remain in US regions, with AWS in `us-west-2` and Modal routed through `us-west`.

## Operational requirements

1. Rotate exposed or staff-departure credentials immediately.
2. Keep S3 public-access blocks and KMS key rotation enabled.
3. Review CloudTrail, share-link audits, failed OTP attempts, and Vercel logs regularly.
4. Run `pnpm security:scan`, tests, typecheck, and a production build before release.
5. Revoke sessions and share links when ownership or recipient access changes.
6. Back up DynamoDB continuously and retain S3 object versions according to the documented retention policy.

## Incident response

Disable the affected Vercel deployment or environment variable, revoke the relevant session/share records, rotate the affected credential or KMS grant, preserve CloudTrail/Vercel/Resend evidence, and notify impacted people based on the actual data and applicable law. Do not include sensitive record contents in tickets or chat.
