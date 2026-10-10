# Data governance record

This file is a working inventory for the final privacy materials. Fill the owner, retention, location, transfer, and DPA fields with verified provider terms before launch.

| System/provider | Purpose | Data that may be sent | Retention/deletion owner | Location/transfer | DPA/terms reviewed |
| --- | --- | --- | --- | --- | --- |
| Managed PostgreSQL | Account, tracker, workspace, security, privacy records | User and workspace data required by the service | `ASSIGN_OWNER` | `VERIFY_PROVIDER` | `PENDING` |
| Email provider | Verification, recovery, notifications | Email address and message content | `ASSIGN_OWNER` | `VERIFY_PROVIDER` | `PENDING` |
| Payment provider | Checkout and paid-plan events | Checkout and subscription identifiers; payment details stay with provider | `ASSIGN_OWNER` | `VERIFY_PROVIDER` | `PENDING` |
| Job-search providers | User-requested job search | Search query and location; provider result data | `ASSIGN_OWNER` | `VERIFY_PROVIDER` | `PENDING` |
| AI provider | User-requested drafting, matching, or research | Prompt content and feature-required job/profile text | `ASSIGN_OWNER` | `VERIFY_PROVIDER` | `PENDING` |
| Bot protection | Abuse prevention on auth | Request metadata and challenge result | `ASSIGN_OWNER` | `VERIFY_PROVIDER` | `PENDING` |

## Repository data classes

- Account/authentication: username, email, password hash, legal acceptance, verification/MFA state, sessions, hashed security tokens, and a keyed hash of the client IP used for abuse/security checks.
- User content: profile, resume text, job leads, applications, activity history, saved searches, workspaces, invitations, and optional AI outputs.
- Operational/billing: usage events, application events, subscription status, checkout identifiers, request IDs, and privacy requests.
- Optional product-usage events are recorded only after the user opts in to Product analytics. AI quota/billing events and security records remain necessary service records.
- Sensitive material intentionally excluded from exports/logs: password hashes, JWTs, session JTIs, raw IP addresses, encrypted provider-key plaintext, MFA secret plaintext, and payment card data.

## Deletion and retention decisions to complete

- Define active-account, closed-account, security-token, session, audit, payment, backup, support, and provider retention periods.
- Confirm whether legal holds or fraud/chargeback records survive account deletion and disclose the limited exception.
- Document backup expiry and the process for deleting a user from recoverable backups when required.
- Document each provider's deletion endpoint/process and the person who verifies completion.
