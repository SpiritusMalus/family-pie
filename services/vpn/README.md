# Family VPN cabinet service

Account/admin API and its payment domain. Deployment requires the acceptance steps in deploy/README.md; a source merge alone does not activate a runtime. Current capability and remaining provider/customer acceptance boundaries are recorded below and in PARITY.md.

Node >=22.16 and built-in SQLite. Run `npm ci && npm test` in this directory. Pinned dependencies provide WebAuthn verification, QR generation, SMTP and web push. Tests use reserved example.invalid identities and explicitly fictional test prices. No real charge or provider call occurs during tests.

## Functional cabinet continuation

`cabinet.mjs` backs owned profiles, payment history, immutable promo/referral order snapshots, stored support threads/messages/private attachments, admin replies and news/read state. Client retry keys avoid duplicate tickets/messages; attachments validate before send and can retry independently. Attachment downloads require the account owner or admin and always use download-only/no-store responses.

`billing.mjs` creates redirect payments with durable order-based provider idempotency, merchant/product/mode/amount binding, receipt configuration, return verification and polling fallback. Notifications are hints re-read through the provider API. Confirmed full refunds revoke entitlement and referral credit; ambiguous creations older than23h require operator reconciliation rather than an expired idempotence-key retry. Partial refunds are still a separate business rule. Existing Sufler merchant reuse is explicitly authorized by the owner; credentials stay outside source and enter the service through systemd LoadCredential. Approved production tariffs are empty until the owner/admin sets them. Native register/admin edits never issue an unpaid key; imported24 unlimited rights remain unchanged.

Password registration works. Passkeys require signed, origin/RP-bound, one-use challenges and user verification. Google uses state-cookie/PKCE/nonce plus signed JWT/audience checks; SMTP email codes bind to the requesting session, expire and limit guesses. Provider linking/key management require a fresh login; removing the final usable sign-in method is rejected. Google client/secret and SMTP delivery must be configured before those controls appear; code/fixture acceptance is not provider acceptance. Expired sessions are pruned, and malformed login requests no longer exhaust a shared login budget.

Push is separately opt-in, restricted to supported browser delivery hosts and excludes unlimited subscriptions; renewal/unlink cancels stale delivery. Ambiguous outcomes are held without blind retries. PWA/service worker caches only public shell assets and never API/account responses. Browser diagnostics measure real HTTP roundtrips/jitter and a small upload/download sample to this server, not ICMP or sustained VPN bandwidth. VPN address indication is unknown when the edge does not provide the original client address.

Referral discounts/reward percentages default off. Admin-approved policy snapshots apply to new orders; only confirmed unreversed payments count. Withdrawal requests reserve available credit; a refund blocks a now-underfunded payout. Actual money transfer is manual outside this cabinet, and admin must supply its confirmation before marking paid. No automatic bank payout or cryptocurrency adapter is claimed.

Implemented: durable accounts/order snapshots, checkout request idempotency, account-scoped orders/support tickets, confirmed-payment entitlements, renewal/expiry calculation, full-refund grant reversal, durable provisioning jobs with leases/retries/revision checks. YooKassaReader verifies payment/refund objects by re-fetching through the authenticated provider API; it rejects wrong shop/test mode/object ID. It never trusts a notification payload or a checkout redirect as payment proof.

## Production boundaries

- Password identities, sessions, CSRF and rate limits are implemented in the account/admin API. Passkeys are implemented; Google/email require their own provider configuration before activation.
- The tariff configuration defaults to empty. Owner-approved prices/devices must be supplied; test fixtures are never production tariffs.
- Refund policy currently supports confirmed full refunds only. Partial refunds require an explicitly designed business rule and tests before exposure.
- A job does not mean provisioned access. A worker must safely upsert/read back the specific account through the currently verified panel API, synchronize UDP/submerge with backups/rollback and re-read current revision before any external write. Skip superseded jobs and use stable profile identity. Do not mark access ready on job enqueue.
- Never open the panel/live family database with this library. Use a separate service-owned private data directory and database; provision directories with0700 and run as a separate unprivileged user. File mode0600 is enforced. Include the database in encrypted backup and test restore before launch.
- Existing Sufler merchant reuse is explicitly authorized and its API/configuration verified. Production tariffs, referral policy, SMTP and Google OAuth still require configuration/approval. Actual payout transfer is manual. No Driftora service data or unapproved credentials are imported.
- No automatic commercial provisioning, public service or server routing is enabled by merging this foundation. Integrate authenticated end-to-end test-store checkout and isolated test provisioning before exposing the service.

## Sources

[YooKassa notifications](https://yookassa.ru/developers/using-api/webhooks), [API interaction format](https://yookassa.ru/developers/using-api/interaction-format), [Node SQLite](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html).

## Account/admin phase

`server.mjs` exposes same-origin private API behind loopback8796. `auth.mjs` stores scrypt hashes (N65536/r8/p2), hashed opaque12h sessions, per-session CSRF and forced initial password change. Existing aliases are logins, not invented email addresses; internal account keys use reserved accounts.invalid. The expanded service conditionally enables provider-backed features and keeps unavailable methods hidden. `panel-worker.py` applies admin changes through currently verified3.4.2 API and reconciles both transports/active profile distribution, with backups/read-back/targeted rollback. See deploy/README.md for actual rollout and acceptance. The public admin is protected by role plus completed password change.
