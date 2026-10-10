# Launch compliance checklist

This is an implementation and launch checklist, not legal advice. A product control is not a substitute for counsel review, a provider agreement, or an operational owner.

## Implemented in the repository

- Versioned Terms and Privacy acceptance is recorded at signup and re-checked when the versions change.
- Public `/terms`, `/privacy`, `/notice-at-collection`, `/cookies`, `/disclaimer`, and `/acceptable-use` pages are available from the landing page, auth screens, and Settings.
- The Notice at Collection identifies collection categories, purposes, service-provider processing, sale/sharing position, retention principles, and available choices.
- Privacy Center supports optional preferences, personal-data export, access/correction/deletion/opt-out requests, password changes, session revocation, MFA, and account deletion.
- Exports include profile data, applications, application history, usage events, privacy requests/preferences, legal acceptances, workspaces, subscriptions, and session metadata without exposing password hashes, JWTs, session JTIs, or raw IP addresses.
- Password-reset, email-verification, and workspace-invitation tokens are stored as hashes, expire, are single-use where applicable, and are cleaned up. Expired/revoked sessions are cleaned up at startup.
- MFA secrets are encrypted at rest. User-provided provider keys and server-owned provider credentials are not returned to the frontend.
- Requests receive an ID, request bodies are capped at 4 MiB by declared content length, and the API/frontend send CSP, HSTS, clickjacking, MIME-sniffing, referrer, and permissions headers.
- Provider attribution, source links, provider terms links, fetch timestamps, and original-application redirects are preserved for saved leads.
- Database migrations run before the production API starts; `/api/health` checks database connectivity and required schema columns.
- Reduced-motion support and semantic, keyboard-friendly controls are present in the main UI.

## Required before declaring production compliance

- Have counsel replace the in-app policy drafts with final Terms, Privacy Policy, Notice at Collection, cookie/storage notice, and any required jurisdiction-specific choice language.
- Set `TERMS_URL`, `PRIVACY_URL`, `NOTICE_AT_COLLECTION_URL`, `TERMS_VERSION`, `PRIVACY_VERSION`, `LEGAL_ENTITY_NAME`, `LEGAL_CONTACT_EMAIL`, and `LEGAL_BUSINESS_ADDRESS`. Set matching `VITE_*` values in the frontend build environment.
- Set `STRICT_LEGAL_CONFIG=true` only after the preceding values are real and the linked policies have been approved. The API health response reports any missing values.
- Decide the age/minor policy with counsel. Configure `MINIMUM_AGE`, `REQUIRE_AGE_CONFIRMATION`, and the signup copy consistently; do not market to children without the required review and controls.
- Configure SMTP and verify deliverability before enabling `REQUIRE_EMAIL_VERIFICATION=true` or relying on password-reset email.
- Inventory every enabled subprocessor and provider, including hosting/database, email, payment, bot protection, job search, and AI. Record purpose, data fields, retention, location/transfer mechanism, DPA status, and deletion behavior in the final privacy materials.
- Review each provider agreement and brand guideline before enabling it; confirm display, caching, attribution, rate limits, and redirect requirements.
- Assign named owners and run the [incident response](INCIDENT_RESPONSE.md), [data governance](DATA_GOVERNANCE.md), and [access/backup](ACCESS_AND_BACKUP_RUNBOOK.md) procedures.
- Perform a restore test from a current database backup and record the result. A health check proves reachability, not recoverability.
- Complete automated, keyboard, screen-reader, contrast, zoom, mobile, and manual WCAG review. Track exceptions and remediation owners.
- If marketing email is introduced, add consent capture, unsubscribe/suppression handling, sender identity, physical address, and transactional-versus-marketing classification before sending.

## Release evidence to retain

- Commit SHA and deployment timestamps for frontend and API.
- `/api/health` response showing `database: "ok"`, PostgreSQL, all schema flags true, and no unresolved legal configuration in the release record.
- Migration output, backup identifier, restore-test result, access review, provider/DPA inventory, accessibility report, and incident drill record.
