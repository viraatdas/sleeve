#!/usr/bin/env bash
set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
  exec gitleaks git --redact --config .gitleaks.toml
fi

if git grep -IEn '(AKIA[0-9A-Z]{16}|re_[A-Za-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' -- ':!pnpm-lock.yaml'; then
  echo 'Potential credential found in tracked files.' >&2
  exit 1
fi

echo 'No credential patterns found in tracked files.'
