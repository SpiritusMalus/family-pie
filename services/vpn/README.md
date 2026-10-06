# Family VPN service foundation

Account/admin API and a separate payment domain library. Deployment and live account import require the acceptance steps in deploy/README.md; a source merge alone does not activate the runtime. Billing, Google/passkey, referrals and support delivery remain unfinished.

Node >=22.16, built-in SQLite, no external dependencies. Run `npm test` in this directory. Tests use reserved example.invalid identities and explicitly fictional test prices. No real charge or provider call occurs during tests.

Implemented: durable accounts/order snapshots, checkout request idempotency, account-scoped orders/support tickets, confirmed-payment entitlements, renewal/expiry calculation, full-refund grant reversal, durable provisioning jobs with leases/retries/revision checks. YooKassaReader verifies payment/refund objects by re-fetching through the authenticated provider API; it rejects wrong shop/test mode/object ID. It never trusts a notification payload or a checkout redirect as payment proof.

## Production boundaries

- Password identities, sessions, CSRF and rate limits are implemented in the account/admin API. Email verification and Google/passkey remain required for those separate sign-in methods.
- The tariff configuration defaults to empty. Owner-approved prices/devices must be supplied; test fixtures are never production tariffs.
- Refund policy currently supports confirmed full refunds only. Partial refunds require an explicitly designed business rule and tests before exposure.
- A job does not mean provisioned access. A worker must safely upsert/read back the specific account through the currently verified panel API, synchronize UDP/submerge with backups/rollback and re-read current revision before any external write. Skip superseded jobs and use stable profile identity. Do not mark access ready on job enqueue.
- Never open the panel/live family database with this library. Use a separate service-owned private data directory and database; provision directories with0700 and run as a separate unprivileged user. File mode0600 is enforced. Include the database in encrypted backup and test restore before launch.
- Live merchant, receipts/tax settings, SMTP, OAuth/passkey origin/RP, support delivery/admin, referral and payout terms are not configured. Existing Driftora credentials are not silently reused.
- No automatic commercial provisioning, public service or server routing is enabled by merging this foundation. Integrate authenticated end-to-end test-store checkout and isolated test provisioning before exposing the service.

## Sources

[YooKassa notifications](https://yookassa.ru/developers/using-api/webhooks), [API interaction format](https://yookassa.ru/developers/using-api/interaction-format), [Node SQLite](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html).

## Account/admin phase

`server.mjs` exposes same-origin private API behind loopback8796. `auth.mjs` stores scrypt hashes (N65536/r8/p2), hashed opaque12h sessions, per-session CSRF and forced initial password change. Existing aliases are logins, not invented email addresses; internal account keys use reserved accounts.invalid. Google/passkey and billing are not enabled. `panel-worker.py` applies admin changes through currently verified3.4.2 API and reconciles both transports/active profile distribution, with backups/read-back/targeted rollback. See deploy/README.md for actual rollout and acceptance. The public admin is protected by role plus completed password change.
