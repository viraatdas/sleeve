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

Set `SLEEVE_LOCAL_DEMO=1` only for local visual development. It is ignored outside the Next.js development environment. Run `pnpm verify` before deployment.
