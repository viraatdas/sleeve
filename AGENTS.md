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

## Execute: Discoveries

- Vercel OIDC should replace static AWS credentials after the first functional deployment; static keys are only a bootstrap path.
- Source files may contain metadata but never the bytes or real values from personal records.

## Execute: Dead-ends tried
