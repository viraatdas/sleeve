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
- Modal app `sleeve-glm-ocr-v2`, volume `sleeve-glm-ocr-models`, and secret `sleeve-extraction-auth` — stop/delete the app, volume, and secret from the Modal `viraat` workspace if abandoned — created 2026-07-11. The superseded `sleeve-glm-ocr` app was stopped after v2 passed live inference.
- Resend sending-only API key `66c52cf0-2aae-4bcc-899d-c9cf5b377ad3` — delete from Resend and remove `RESEND_API_KEY` from Vercel if abandoned — created 2026-07-11.

## Execute: Discoveries

- Vercel OIDC should replace static AWS credentials after the first functional deployment; static keys are only a bootstrap path.
- Source files may contain metadata but never the bytes or real values from personal records.
- Vercel project `sleeve` is linked locally and has team-scoped OIDC enabled; runtime tokens arrive through Vercel's request context/header, while local development tokens are pulled to ignored `.env.local`.
- Validate CloudFormation with `uvx cfn-lint infra/aws/sleeve.yaml`; `cfn-lint` is not installed as a standalone command on this machine.
- The connected Resend account is limited to one verified domain (`mg.exla.ai`), so production currently sends as `Sleeve <sleeve@mg.exla.ai>`; adding `sleeve.viraat.dev` requires a Resend plan/domain-slot change and must not delete the existing Exla domain.
- Browser S3 uploads must consume the API-provided signed KMS headers; do not sign `Content-Length`, because browsers set it themselves and forbid JavaScript from assigning it.
- DynamoDB transactions authorize their underlying `PutItem`/`UpdateItem`/`DeleteItem`/`ConditionCheckItem` actions; `dynamodb:TransactWriteItems` is not a valid IAM action and fails CloudFormation linting.
- The production DynamoDB TTL attribute is `ttl`; the staged `expiresAt` disable and `ttl` enable migration completed successfully with status `ENABLED`.
- `sleeve-glm-ocr-v2` passed live L4 inference against a fully synthetic passport image; keep production `MODAL_EXTRACT_URL` pinned to its `us-west` endpoint.
- Vercel `MODAL_SHARED_SECRET` must equal `EXTRACTION_BEARER_TOKEN` in the Modal secret `sleeve-extraction-auth`; the v1→v2 migration left them out of sync (Modal returned 401, surfaced in the app as "extraction isn’t available right now"). Rotated both to a fresh token on 2026-07-11. Rotation order: update the Modal secret, redeploy the Modal app, update the Vercel production env, then redeploy Vercel.

- GLM-OCR latency on the L4 scales with input resolution: a 12 MP phone photo ran past Modal's 150 s sync HTTP window and the 180 s function timeout, while the same document at 1280 px extracts correctly in ~60-70 s. The Modal service caps inference images at `MAX_INFERENCE_EDGE = 1280`, and the app's extraction fetch timeout is 150 s (route `maxDuration` 180).

## Execute: Dead-ends tried

- `uvx modal deploy` from `modal/` lacks local FastAPI imports; use `uv run modal deploy -m sleeve_extractor.service` inside the locked project environment.
- `vercel env add NAME production < file` silently stores an EMPTY value in agent shells (CLI 54 detects non-interactive and skips stdin) — this is how the Modal secret broke. Use `--value "$TOK"`, avoid `--sensitive` (sensitive values cannot be pulled back for verification), and verify with `vercel env pull` + compare before redeploying.
- Modal image build with `transformers==5.13.0` and `safetensors==0.7.0` is unsatisfiable; Transformers 5.13 requires `safetensors>=0.8.0`.
- GLM-OCR's Transformers processor imports image/video utilities from Torchvision; pair `torch==2.9.1` with `torchvision==0.24.1`.
- Treat the cached Modal model as usable only when `/models/glm-ocr/.ready` exists; a processor config can survive an interrupted first download without any model weights.
- DynamoDB rejects a one-step TTL attribute rename (`expiresAt` → `ttl`); disable TTL on the old attribute, wait for `DISABLED`, then deploy the template with the new enabled attribute.
