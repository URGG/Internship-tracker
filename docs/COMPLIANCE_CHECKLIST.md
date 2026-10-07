# Launch compliance checklist

This checklist describes product controls in the repository and launch work that requires a business/legal decision. It is not legal advice.

## Implemented product controls

- Versioned Terms and Privacy acceptance at signup.
- Public `/terms`, `/privacy`, `/cookies`, `/disclaimer`, and `/acceptable-use` pages backed by deployment-configurable versions and contact details.
- Privacy Center for preferences, data export, access/correction/deletion requests, and account deletion.
- Password change, password reset hooks, session listing/revocation, email verification hooks, and optional authenticator-app MFA.
- Provider attribution, source links, provider terms links, and original-application redirects.
- Encrypted user API keys and server-side provider credentials.
- Reduced-motion support and keyboard-friendly semantic controls in the main UI.

## Required before production

- Replace the policy-page drafts with attorney-reviewed Terms, Privacy Policy, Notice at Collection, and any California privacy-choice language.
- Set `TERMS_URL`, `PRIVACY_URL`, `TERMS_VERSION`, `PRIVACY_VERSION`, `LEGAL_ENTITY_NAME`, `LEGAL_CONTACT_EMAIL`, and `LEGAL_BUSINESS_ADDRESS`.
- Configure SMTP before enabling `REQUIRE_EMAIL_VERIFICATION=true` or password-reset email.
- Document all subprocessors, API providers, payment processors, AI providers, retention periods, international transfers, and deletion behavior in the policies.
- Review each provider agreement and brand guideline before enabling it; confirm display, caching, attribution, rate limits, and redirect requirements.
- Create an incident-response owner, breach-notification runbook, backup/restore policy, access-review schedule, and vendor data-processing agreements.
- Decide whether the service is available to minors and set the minimum-age/COPPA policy accordingly.
- Review accessibility with keyboard, screen reader, contrast, zoom, and automated/manual WCAG checks.
- If marketing email is sent, configure suppression/unsubscribe handling, sender identity, physical address, and consent/transactional classifications.
