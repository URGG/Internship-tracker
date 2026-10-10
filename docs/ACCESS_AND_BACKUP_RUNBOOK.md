# Access review and backup/restore runbook

## Access review

Run monthly and after an employee, contractor, provider, or ownership change.

1. Export the list of hosting, database, payment, email, AI, job-provider, repository, and deployment accounts.
2. For each account record owner, role, MFA status, last use, purpose, and expiry/review date.
3. Remove dormant access, shared credentials, unused API keys, and access that is broader than the person's job.
4. Confirm production secrets are stored only in the deployment secret manager and are not in source, frontend bundles, logs, or support tickets.
5. Record reviewer, date, exceptions, remediation owner, and due date.

## Backup and restore

- Database: `ASSIGN_BACKUP_PROVIDER_AND_SCHEDULE`
- Backup encryption/key owner: `ASSIGN_OWNER`
- Recovery point objective: `DECIDE`
- Recovery time objective: `DECIDE`
- Restore-test owner: `ASSIGN_OWNER`

For every restore test:

1. Create an isolated restore target; never overwrite production for a test.
2. Restore a dated backup and run `alembic upgrade head`.
3. Verify `/api/health`, all required schema flags, representative account/workspace isolation, exports, and deletion behavior.
4. Record backup ID, source timestamp, restore duration, migration result, validation result, and any data loss or mismatch.
5. Destroy the test restore according to the documented retention procedure and rotate any temporary credentials.
