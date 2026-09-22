# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | Yes |

## Reporting a Vulnerability

1. **Do NOT** open a public GitHub issue
2. Use [GitHub's private security advisory](https://github.com/VictorNain26/tomai-monorepo/security/advisories/new)
3. Include: description, reproduction steps, potential impact

We will acknowledge within 48 hours and provide a fix timeline within 7 days.

## Security Measures

- Dependency updates opened by Renovate (`.github/renovate.json`: minor/patch auto-merged
  once CI is green after a 3-day release age, majors reviewed by a human); Dependabot
  only raises vulnerability alerts
- Secret scanning (Gitleaks), SAST (Semgrep) and `pnpm audit` (prod, high+) on every
  push/PR to `main` (`.github/workflows/security.yml`)
- SHA-pinned GitHub Actions (supply chain protection)
- Non-root Docker containers (user `tomai`, UID 1001)
- AES-256-GCM encryption for Pronote credentials (PBKDF2 600K iterations)
- Security headers on the landing page (`apps/landing/vercel.json`: nosniff,
  X-Frame-Options, Referrer-Policy, Permissions-Policy) and the server; no CSP yet (lot 3)
