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

- Dependencies monitored by Dependabot (auto-merge patch/minor)
- Secret scanning via Gitleaks on every push/PR
- Dependency review on PRs (blocks high-severity vulnerabilities)
- SHA-pinned GitHub Actions (supply chain protection)
- Non-root Docker containers (user `tomai`, UID 1001)
- AES-256-GCM encryption for Pronote credentials (PBKDF2 600K iterations)
- Security headers on landing page (X-Frame-Options, CSP, etc.)
