#!/usr/bin/env bash
set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
  exec gitleaks git --redact --config .gitleaks.toml
fi

pattern='(A(KIA|SIA)[0-9A-Z]{16}|re_[A-Za-z0-9_-]{20,}|ak-[A-Za-z0-9_-]{20,}|as-[A-Za-z0-9_-]{28,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)'
if git ls-files --cached --others --exclude-standard -z | xargs -0 rg -In "$pattern"; then
  echo 'Potential credential found in tracked files.' >&2
  exit 1
fi

echo 'No credential patterns found in tracked files.'
