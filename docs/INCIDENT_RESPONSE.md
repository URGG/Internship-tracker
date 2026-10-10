# Incident response runbook

Assign named people to the roles below before launch. The placeholders are intentional: the repository cannot safely invent an incident owner, legal contact, or notification authority.

## Roles

- Incident commander: `ASSIGN_OWNER`
- Security/engineering owner: `ASSIGN_OWNER`
- Privacy/legal owner: `ASSIGN_OWNER`
- Communications owner: `ASSIGN_OWNER`
- Hosting/database escalation: `ASSIGN_PROVIDER_CONTACT`

## First 24 hours

1. Open a private incident record with UTC timestamps, reporter, affected systems, request IDs, and the last known good deployment.
2. Preserve logs and relevant database records. Do not copy passwords, tokens, raw payment data, or unnecessary personal data into the incident record.
3. Contain the issue: disable the affected feature/provider, revoke affected sessions/tokens, rotate compromised secrets, and deploy the smallest reviewed mitigation.
4. Check database integrity, provider logs, authentication events, exports, billing events, and recent deployments for scope.
5. Notify the privacy/legal owner and determine whether contractual, regulatory, user, or provider notifications are required and on what timeline.
6. Communicate only verified facts. Record decisions, uncertainty, and next review time.

## Recovery and closeout

- Restore service from a known-good deployment or backup only after integrity checks.
- Confirm rotated secrets are active and old secrets are revoked.
- Verify login, data isolation, exports, deletion, payments, provider calls, and all public legal routes.
- Record root cause, affected data categories, dates, users/tenants affected, notifications, corrective actions, and evidence.
- Hold a post-incident review within 10 business days and update tests/runbooks.

## Tabletop drill

Run at least one drill before launch and after material architecture changes: a leaked credential, a cross-workspace authorization bug, and an unavailable database backup are the minimum scenarios to exercise.
