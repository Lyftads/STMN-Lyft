# Incident Response Plan — Lyft SRL / LyftAI

> Owner: Marino Catasta (founder — incident commander). Review: every 6 months.
> Last review: 2026-07-27.

## Scope

Security incidents affecting LyftAI (lyftai.io): unauthorized access, credential
leak, data breach, or misuse of merchant data — including data obtained via
third-party APIs (Shopify, Meta, Google, Klaviyo, Amazon SP-API, banking).

## Roles

- **Incident commander**: Marino Catasta (only person with production access).
- Escalation contacts: Vercel support (hosting), Supabase support (database),
  the affected API provider's security team.

## Procedure (24/7)

1. **Detect & assess** (within hours): confirm the signal (Vercel logs, Supabase
   logs, provider alerts), identify affected data and tenants.
2. **Contain** (immediately): revoke affected OAuth tokens/keys (Nango dashboard,
   provider consoles), rotate secrets in Vercel env, block the offending route
   if needed (deploy or env kill-switch).
3. **Notify**:
   - Amazon data involved → email **security@amazon.com within 24 hours** of
     detection (Amazon Data Protection Policy requirement).
   - Personal data involved → notify the supervisory authority within **72 hours**
     (GDPR art. 33) and affected merchants without undue delay.
   - Other providers per their program terms (Meta, Google, Shopify).
4. **Eradicate & recover**: patch the vulnerability, verify with tests, restore
   normal operation, re-issue credentials.
5. **Post-mortem** (within 7 days): written summary — cause, impact, timeline,
   fixes, prevention. Stored in this repo under docs/.

## Standing controls (referenced by security questionnaires)

- Credentials only in environment variables / Nango encrypted storage — never in
  code or public repositories.
- TLS 1.2+ in transit everywhere; AES-256 at rest (managed by Supabase).
- Access to Amazon/merchant information restricted by job function: production
  access is limited to the founder.
- Passwords: 12+ characters, MFA enabled on all work accounts (Amazon, Google,
  Vercel, Supabase, GitHub), reviewed/rotated annually.
- Semiannual review of this plan and of sub-processors (see SUBPROCESSORS.md).
