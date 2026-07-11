# Sleeve agent guide

## Product constraints

- Read `PRODUCT.md`, `DESIGN.md`, and `SECURITY.md` before changing user-visible or security-sensitive behavior.
- Sensitive files are private by default. Never add document contents, real identifiers, access tokens, signed URLs, OTPs, or secrets to logs, fixtures, snapshots, analytics, URLs, or commits.
- Every server mutation must verify an authenticated owner and person-level access. Share links are token-scoped, revocable, and expire after 15 minutes by default.
- UI targets WCAG 2.2 AA, 320px mobile width, 44px touch targets, keyboard operation, and reduced motion.

## Commands

- `pnpm dev` — local development
- `pnpm lint` — lint
- `pnpm typecheck` — TypeScript
- `pnpm test` — unit tests
- `pnpm build` — production build

## Execute: Orphans

- Vercel project `viraatdas-projects/sleeve` — remove with `vercel project rm sleeve` if abandoned — created 2026-07-11 by deployment setup.
- AWS IAM OIDC provider `arn:aws:iam::597088032164:oidc-provider/oidc.vercel.com/viraatdas-projects` — remove only after all team Vercel roles are gone — created 2026-07-11 for Sleeve.
- AWS CloudFormation stack `sleeve-production` in `us-west-2` — disable DynamoDB deletion protection and empty retained storage before teardown — created 2026-07-11.
- Modal app `sleeve-glm-ocr` and secret `sleeve-extraction-auth` — stop/delete the app, volume, and secret from the Modal `viraat` workspace if abandoned — created 2026-07-11.
- Resend sending-only API key `66c52cf0-2aae-4bcc-899d-c9cf5b377ad3` — delete from Resend and remove `RESEND_API_KEY` from Vercel if abandoned — created 2026-07-11.

## Execute: Discoveries

- Vercel OIDC should replace static AWS credentials after the first functional deployment; static keys are only a bootstrap path.
- Source files may contain metadata but never the bytes or real values from personal records.
- Vercel project `sleeve` is linked locally and has team-scoped OIDC enabled; runtime tokens arrive through Vercel's request context/header, while local development tokens are pulled to ignored `.env.local`.
- Validate CloudFormation with `uvx cfn-lint infra/aws/sleeve.yaml`; `cfn-lint` is not installed as a standalone command on this machine.
- The connected Resend account is limited to one verified domain (`mg.exla.ai`), so production currently sends as `Sleeve <sleeve@mg.exla.ai>`; adding `sleeve.viraat.dev` requires a Resend plan/domain-slot change and must not delete the existing Exla domain.
- Browser S3 uploads must consume the API-provided signed KMS headers; do not sign `Content-Length`, because browsers set it themselves and forbid JavaScript from assigning it.
- DynamoDB transactions authorize their underlying `PutItem`/`UpdateItem`/`DeleteItem`/`ConditionCheckItem` actions; `dynamodb:TransactWriteItems` is not a valid IAM action and fails CloudFormation linting.

## Execute: Dead-ends tried

- `uvx modal deploy` from `modal/` lacks local FastAPI imports; use `uv run modal deploy -m sleeve_extractor.service` inside the locked project environment.
- Modal image build with `transformers==5.13.0` and `safetensors==0.7.0` is unsatisfiable; Transformers 5.13 requires `safetensors>=0.8.0`.
- DynamoDB rejects a one-step TTL attribute rename (`expiresAt` → `ttl`); disable TTL on the old attribute, wait for `DISABLED`, then deploy the template with the new enabled attribute.
