# Family VPN first connection and Telegram service

This change is prepared for rendered-preview review. It is not publication approval.
The website and native bot share account, order, entitlement and provisioning state.
Website RUB/YooKassa payments and Telegram Stars payments remain separate providers.

## Current checkout direction — 2026-10-28

New bot purchases use the saved website RUB catalogue and open the existing
YooKassa website checkout. Selecting a term does not create an order or charge.
The selected term travels in the server-bound, one-use login handoff; successful
consumption opens only the fixed cabinet plans route. Query parameters cannot
override the consumed account or term. Expired links retain a bounded ordinary
sign-in fallback. Historical Stars payment and refund events remain supported.

The bot documents `/renew 30` and the other available terms as keyboard input.
Registration also accepts the exact displayed consent text after a delivered,
unexpired notice for the same private actor, guest scope and current legal version.
Replays, forwarded messages and stale notices cannot create another account.

An optional operator QA lane is off by default. A separate pinned owner, private
credential and at most three-hour case route genuine Telegram UI updates into an
initially empty, isolated database. It uses the same handlers and a sole TEST
30-day/300-RUB plan. Its merchant belongs only to the separate guarded web stage;
the bot never loads a payment key. Financial events and support remain on their
existing routes. Configuration failures fence only the pinned QA actor. A QA
case is not a production sale, and source tests do not prove a live payment or
physical VPN connection.

Email support remains a plain readable `mailto` link on public and authenticated
screens. Email-copy controls have been removed; personal VPN-link and invitation
copying remain available.

## Customer behavior

The public header includes My account. A confirmed website payment continues to the
selected device setup, including while access is being provisioned. Installation,
personal import, manual URL and a clearly secondary second-device QR are in one
guide. The app does not need the website password. Installation links, app returns,
refresh and sign-in retain the selected device; the server remains authoritative
about payment and current provisioning readiness. A button click never means that
VPN traffic was verified.

Telegram linking is an explicit service step, with ownership confirmation, expiry,
interruption and recovery. It does not revoke already paid access when unlinked.
The bot offers subscription status, device setup, support, explicit term purchases
and renewal. Reminder opt-out is distinct from unlinking. Existing website accounts
bind through their authenticated ownership proof. The bot never guesses a merge
from a username, email or receipt. Telegram-first customers have an explicit
passwordless authentication method and can add another verified recovery method.

The bot's HTTPS handoffs use hashed, one-use, five-minute tokens in URL fragments.
The browser removes the fragment before networking. Website login first previews
the account and requires an explicit confirmation; another valid signed-in account
cannot be silently replaced. Import handoffs do not establish a website session.
Copy/manual import works without a cabinet round-trip. Keep personal links out of
logs and analytics, public captures and forwarded callbacks.

Onboarding events contain only an allowlisted stage and platform. The database
stores daily counts for 90 days, without account IDs, IPs or personal URLs. Short-lived
in-memory per-account limits prevent abuse. These are action counts, not evidence
of a successfully connected physical device.

## Forgotten passwords and legacy recovery

The sign-in screen has an explicit Forgotten password path. Enter a login or an
already verified recovery email, receive a code, then set a new password. Public
acknowledgements have the same shape for known, unknown and ineligible identifiers.
Mail is dispatched asynchronously; the acknowledgement does not prove that a message
was delivered. Only `verified_emails` establishes email ownership. An order's receipt
email, profile receipt email, account email placeholder, display name or payment
screenshot must never bootstrap recovery or merge accounts.

Recovery email uses `smtpSender(to, code, {purpose:'recovery'})`, a recovery-specific
subject and instructions with ten-minute validity. Ordinary sign-in mail still says
five minutes. Codes are hashed, expire after ten minutes and allow five failed guesses.
Request/resend limits include a sixty-second cooldown and per-identifier/recipient
mail limits. A resend rotates only the supplied challenge for that same identifier;
another browser's pending proof is not canceled by a fresh public request.

For a confirmed Telegram binding, `/recover`, `/recovery` and `?start=recover` provide
a reset-only link even when native navigation and Stars sales are disabled. The
five-minute, one-use fragment token binds the exact private chat, current link
generation and credential version. It can recover an account still under the initial
password-change gate; it cannot disclose a subscription or create a normal login
session. Unlinked, disabled or revoked bindings receive the ownership/support path.
The public Telegram availability flag describes configured capability, not whether a
particular visitor has a binding.

Legacy users without an established recovery method need owner-assisted verification.
A current administrator must have recent authentication proof, CSRF and an explicit
ownership check through a previously known channel before issuing a fifteen-minute
one-use link. The administrator selects an exact account ID; the service never maps
people by name or infers ownership from a receipt/unverified address. Deliver the
link manually through that verified channel. Issuance itself does not change the
password, revoke sessions or alter VPN access. The raw token is shown only in the
initial response and is never stored in the database. Retrying the same request key
returns an already-issued acknowledgement, not another copy of the token.

The browser removes reset fragments before network requests. Preview identifies the
target account without consuming proof. A different valid signed-in account causes
a conflict before any reset, with no forced logout or proof consumption. Successful
reset sets the new password, clears the first-password gate, revokes all existing
sessions and retires all account-specific recovery codes/links. It does not log the
person in automatically; they sign in normally with the new password. Account ID,
personal VPN identity, paid grants, expiry and legacy-unlimited rights are preserved.

Ordinary verified-email sign-in also avoids the forgotten-old-password loop:
`/me.authMethod` and `passwordSetupAllowed` identify a recent established alternative
method, and the gated screen asks only for the new password via `/password/set`.
Subscription/cabinet data remains gated until password setup completes. A temporary
password-only session retains its existing password-change path; stale or removed
alternative proof cannot bypass that gate.

Authenticated `/password/set` is a different contract from unauthenticated recovery:
it revokes all old sessions, then returns a fresh rotated session/cookie so the
already authenticated person can continue to the cabinet. Keep that behavior for
settings and alternative-method password setup. The no-automatic-login guarantee
applies specifically to `recovery/confirm` and `recovery/reset`, which return no
session/cookie and lead back to normal sign-in.

As of the read-only 2026-10-27 pre-release production check, no verified recovery email
was enrolled. This change does not enroll customers or restore particular people's
access by itself. Existing Telegram bindings require an exact verified owner match;
legacy accounts without such a method still need the exact identifier and the
owner's known-channel check before a real recovery link may be issued. No individual
account recovery, live code delivery or password reset was performed for this preview.

### Recovery API and proof retirement

All routes are under `/vpn/api/` and require the allowed browser origin. Public reset
proof never grants an admin capability or unpaid subscription.

| Route | Purpose |
|---|---|
| `POST recovery/request` | Generic email-code request; optional owned `challengeId` for resend |
| `POST recovery/confirm` | Code plus new password; returns success/login without a session |
| `POST recovery/preview` | Inspect a valid fragment token without consuming it |
| `POST recovery/reset` | Token plus new password; returns success/login without a session |
| `POST admin/recovery-links` | Recent admin, CSRF, exact account, request key and `ownershipVerified:true` |

Expiration, successful use or a changed credential version retires a proof. Changing
or removing the verified email invalidates its old code. Telegram unlink/rebind
invalidates its old reset token, independently of reminder opt-out. Removing the
issuing administrator's authority invalidates an administrator-issued token. A new
admin request key deliberately retires prior admin links for that account; old-key
retries never recreate them. Concurrent resets have one successful consumer.

Closing or canceling the browser form clears the local UI; it does not revoke a code
already emailed or a link already shared. There is no separate proof-cancel API in
this change. Use expiry or deliberate same-kind reissue where retirement is needed.
Invalid proofs and exhausted guesses do not lock or change the account. Never restore
an older database or old password hash to make a retired proof usable again.

## Features and payment gates

`VPN_TELEGRAM_NATIVE_UI=1` enables the expanded native navigation. Default is off.
The account recovery bridge and durable handling of existing financial events stay
available independently of that navigation flag.

New Stars invoices require all of:

- `VPN_TELEGRAM_STARS_ENABLED=1`
- `VPN_TELEGRAM_STARS_APPROVED=1`
- `VPN_TELEGRAM_STARS_PLANS_FILE` pointing to an operator-protected JSON array of
  explicit `{ "days": 30, "stars": INTEGER }` records (allowed terms 30/90/180/365).

No Stars price is approved or inferred from the current RUB price by this change.
Do not enable sales until the owner approves exact prices, account payout eligibility
and merchant obligations are checked, and the dedicated Telegram payment-test
environment passes. That environment needs its own test account/bot credentials;
a production token and injected test sender do not establish that acceptance.

An accepted pre-checkout is not a charge. The service grants exactly once only from
a validated successful payment with matching actor, immutable order, amount,
currency and provider. Renewals use the same account and provisioned revision.
Refund requests are durable; an ambiguous send is not blindly repeated. Entitlements
change after confirmed refunds, preserving later independent purchases. Stars
orders display their own unit amount in the website and continue payment in Telegram.

Official sources checked for this implementation:
[digital payments](https://core.telegram.org/bots/payments-stars),
[platform terms](https://telegram.org/tos/bot-developers#6-2-digital-goods-and-services),
[dedicated test environment](https://core.telegram.org/bots/webapps#using-bots-in-the-test-environment).

## Preview and reproducible checks

Build with Node22, matching CI:

```sh
npm ci --prefix services/vpn
node tools/build-legal.mjs
node tools/build-customer-site.mjs
node tools/build-portfolio-site.mjs
node --test tools/test-customer-site.mjs tools/test-vpn-search.mjs tools/test-customer-retirement.mjs tools/test-i18n.mjs tools/test-home-theme.mjs tools/test-portfolio.mjs tools/test-vpn-shell.mjs tools/test-vpn-payment-return.mjs tools/test-vpn-purchase-flow.mjs tools/test-vpn-telegram-link.mjs tools/test-vpn-telegram-entry.mjs
node --test services/vpn/test/*.test.mjs
node --test tools/test-vpn-recovery.mjs
```

Bot presentation is reviewed directly in Telegram. The owner rejected a separate
HTML bot-preview page as noise. Keep the branded media build tool; do not recreate
a website or explanatory wrapper around the Telegram dialogue. Keep the animation,
factual capabilities, current status and action buttons. Omit duplicate branding,
generic slogans and an obvious action prompt. The support email stays as text;
no email-copy button is added. Personal VPN-link copying remains available.
Synthetic handlers and service tests remain useful internal checks; they do not
prove real delivery.

Recovery acceptance includes a gated legacy account with a verified synthetic email,
an account without any recovery method, a confirmed gated Telegram account with
navigation disabled, and owner-assisted reset after explicit synthetic identity
verification. Exercise unknown/receipt-only/ambiguous identifiers, unavailable or
failed SMTP, expiry, cooldown, guess limits, owned resend, stale/rebound proof,
different-account conflict, repeated issuance, replay and concurrent reset. Verify
ordinary alternative-email login can set the new password without the old one.
Use the real local HTTP endpoints and rendered RU/EN desktop/mobile entry points;
assert no automatic session, all old sessions revoked and unchanged account/VPN
identities, paid grants and legacy rights. Injected SMTP/Telegram senders do not prove
inbox delivery, actual private Telegram delivery or recovery of a real customer.

## Publication and rollback

1. Obtain the owner's approval of the shown website and bot preview. Do not merge
   to deploy-triggering main before that approval.
2. Read the current VPN operating rules and verify actual live topology, API and
   runtime versions. Back up the affected configuration and a consistent SQLite
   database on the same authorized application host. Keep secrets and live customer
   databases on their existing authorized targets.
3. Deploy the additive backend migration with Stars sales and native navigation
   disabled first. Verify existing web purchase, pending/provisioned access,
   legacy-unlimited accounts, support and all authentication/recovery methods.
   Back up the consistent cabinet database, current source/environment and SMTP/bot
   credential references on that same authorized host before migrating recovery
   tables. Recovery adds `recovery_challenges`, `recovery_rate`, `recovery_tokens` and
   `recovery_admin_requests`, plus issue/complete audit actions. Preserve password,
   session, verified-email and Telegram-binding state; do not enroll contacts or issue
   customer tokens as a migration step. Install/verify the existing single worker's
   always-available `/recover` route before publishing UI that advertises it.
4. Release the approved website via existing main CI/static deployment. Verify the
   integrated commit, exact CI result, public static revision, actual backend process
   revision and changed behavior separately. A source archive pull is not deployment.
5. Enable the approved bot navigation/branding through its existing single worker;
   never run a second getUpdates consumer. Verify owner-only real Telegram flow and
   physical iPhone/Android import before calling the complete journey accepted.
6. Enable Stars only after the separate price/provider/test gates pass. Preserve
   payment/support terms and refund/support operations.

To stop new native sales, disable the sales flag. To roll back navigation, disable
the UI flag. **Keep the financial consumer active** for late successful payments,
refunds and pending acknowledgements. Do not roll back to an old consumer that
does not understand native orders or replay an older customer database. Website
assets can be reverted through a scoped PR/CI release. Once native identities or
invoices exist, reconcile their state before any older backend rollback.

Recovery rollback must keep newer customer passwords, login-method enrollment,
sessions and retirement/idempotency records. Reverting static assets does not undo a
completed password reset, and restoring pre-reset credentials would restore obsolete
access. Do not copy a live database off-host or restore its whole old backup. If an
older backend/worker cannot consume the new reset routes, stop advertising those
methods and retain an explicit known-channel support route; do not leave an apparent
working reset button pointing to an unsupported service. Outstanding tokens may only
be honored by the matching proof validator or allowed to expire. Retain additive
recovery tables and audit evidence, even when rolling back presentation. Financial
event handling and its separate Stars rollback gates above remain mandatory.

This work does not change DNS, VPN transport, IP allocation, client identities,
MSS/PMTU, retention safeguards, legacy-unlimited access or device limits. Existing
subscription delivery incidents remain separate prerequisites for final real-device
acceptance. No physical-phone, live payment or production delivery claim follows
from the synthetic preview checks.

## Isolated Telegram Stars sandbox

`tools/vpn-stars-sandbox.mjs` is a manual, foreground harness for Telegram's separate
TEST server. It reuses the real private-chat UI, commerce, payment transaction and
refund handlers. The production worker is unchanged: `TelegramClient` still selects
production by default. Only the sandbox explicitly selects the fixed
`https://api.telegram.org/bot<TEST_TOKEN>/test/METHOD_NAME` route; invalid environments
fail and a rejected test token never falls back to production.

First create a separate test account and a separate test BotFather bot using the
[official test-server setup](https://core.telegram.org/bots/webapps#using-bots-in-the-test-environment).
Supply that bot's expected ID/username and an explicit allowlist of users from that
same TEST environment. Production credentials, production user IDs and an injected
sender are not a substitute for this acceptance. Test-account balance/top-up and
seller withdrawal eligibility still need owner verification. No real Telegram test
was performed merely by adding this tool.

Use pinned Node22 on macOS/Linux. Keep the credential file and JSON configuration
owned by the invoking user, without group/world permissions (normally0600). Do not
put a token in the JSON, source, command line, chat or logs. The following values are
fictional placeholders; one Star is a sandbox amount, not an approved live price:

```json
{
  "environment": "test",
  "credentialFile": "/absolute/private/test-bot.token",
  "expectedBot": {"id": 123456789, "username": "replace_test_bot"},
  "allowedUserIds": [987654321],
  "stateDir": "/absolute/private/new-stars-sandbox",
  "plans": [{"days": 30, "stars": 1}],
  "maxRunSeconds": 900
}
```

```sh
node tools/vpn-stars-sandbox.mjs --config /absolute/private/stars-test.json
```

The config is explicit; the harness neither loads service.env nor accepts an inherited
`VPN_*`/`CREDENTIALS_DIRECTORY` environment. Known production credential/database
roots, credential symlinks, shared credential files and an existing state directory
are rejected. The state parent must not be writable by others unless it is a sticky
temporary directory. Read-only `getMe` and `getWebhookInfo` must confirm the exact test
bot and an empty webhook before any state/lock creation or polling. It does not remove
webhooks or stop other consumers. A private, bot-specific lock prevents two harnesses
on the same host; a stale lock needs manual inspection, never automatic removal.

After preflight, only the fresh state directory's SQLite database is opened. Directories
are0700 and private files0600. The allowlist filters updates before actual handlers
see them; ignored updates advance the durable offset without sending a reply or
creating an account. Outgoing messages, invoices and refunds are restricted to the
same approved test users. Nothing is automatically sent at startup: a tester starts
with `/menu`, creates or links an account, then chooses a term and explicitly accepts
that purchase's terms before an invoice appears.

Acceptance sequence, only after the dedicated test credentials are available:

1. Confirm a refused identity/webhook/config leaves no state and makes no polling or
   send call. Confirm another process cannot acquire the same test bot lock.
2. In the TEST account, open the test bot, send `/menu`, create or link an account,
   choose a term, review its total and confirm the purchase terms. Check the invoice
   uses XTR, one integer price and the expected test amount.
3. Complete the test payment in Telegram. Check a pre-checkout acknowledgement alone
   grants nothing; a validated successful payment creates one grant and a pending
   provisioning job. Replayed updates must not extend the entitlement twice.
4. Purchase another term in that same isolated account to check renewal. The retained
   SQLite evidence contains the test order IDs. To queue a deliberate test refund,
   enter a JSON control line on the harness's private stdin:
   `{"action":"refund","orderId":"SANDBOX_ORDER_UUID"}`.
   The tool does not echo the ID. Only a matching Stars order owned by an allowlisted
   test user is accepted; the real adapter handles confirmation/uncertainty.
5. Review the private state/events and test expiry after refund. Stop with Ctrl-C or
   let the bounded session expire. Retain uncertain sessions for review rather than
   replaying a refund or replacing their database.

The harness never starts a panel worker, touches a live panel, applies grants to a
production account or publishes a usable VPN profile. Paid access correctly remains
preparing because provisioning is absent. Website/handoff destinations use reserved
`sandbox.invalid` and are not a live website. Do not use them for app import, recovery
or physical traffic checks; no Happ configuration is changed. This harness does not
claim website, real-device or seller payout acceptance.

Each run requires a fresh state directory; old state is retained as private evidence.
There is no automatic resume or raw-update log. Events contain only controlled event
names/counts, without credentials, message bodies or Telegram IDs; public output is
generic. Existing offline tests cover durable handler/offset restart behavior. A
provider-ledger recovery acceptance for outages beyond Telegram's update retention,
seller eligibility, explicit production XTR prices and real test-server payment/refund
acceptance remain gates before enabling production Stars. The sandbox does not approve
or enable live prices.

Focused checks use synthetic credential files and injected responses only:

```sh
node --test services/vpn/test/telegram-client-environment.test.mjs tools/test-vpn-stars-sandbox.mjs
```

## Stars purchase consent

Every new purchase follows: choose term → review term, total Stars and terms/privacy
links → explicitly press `Принимаю, перейти к оплате` → receive the invoice. This
applies equally to Telegram-native and returning website accounts. Registration
acceptance is separate; migration creates an empty purchase-consent table and never
silently accepts terms for legacy accounts or invoices.

Commerce stores the accepted notice snapshot, version/hash, account, private chat,
link generation, request key, term and exact Stars amount, then binds that proof to
one order. Unissued offers expire after ten minutes; at most five are outstanding per
account. Expired unbound offers are pruned, while order-linked acceptance remains.
Invoice retries retain the order's original price. Changed terms or Telegram binding
invalidate pre-checkout until explicit confirmation again; late successful payments
and refunds keep their existing financial handling. Bump `TELEGRAM_STARS_TERMS.version`
when the notice or linked purchase terms change. Internal versions stay out of bot copy.

The consent/sandbox checkpoint passed **209/209** service and runner tests on
Node22.23.3, plus syntax and diff checks. Tests used synthetic credentials and injected
responses; they do not prove a real Telegram payment. Before production enablement,
review the public legal copy for Stars payment/refund specifics (the current page
describes website YooKassa payments), verify seller/reward eligibility, approve exact
XTR prices, and complete dedicated TEST payment, renewal and refund acceptance.
Provider-ledger recovery remains separate; a report-only comparison cannot apply a
missed payment or establish that an absent transaction never occurred. Live Stars
flags stay disabled until these gates and the shown-preview approval are satisfied.


## Manual Stars ledger report

`node tools/vpn-stars-ledger-report.mjs --config /absolute/private/report.json`
compares bounded Bot API ledger pages with a closed, consistent private SQLite
backup. The private JSON config requires `mode: "report"`, explicit `environment`
(`test` or `production`), `credentialFile`, exact `expectedBot` id/username,
`databaseSnapshotFile` and a new `outputFile` in a private directory. Optional
`pageSize` is1–100 and `maxPages` is1–20. The tool rejects known live database roots,
sidecars/WAL-mode files and an existing output. It calls only `getMe` and
`getStarTransactions`; it neither polls updates nor sends a payment/refund request.

The private report matches stored actor, amount, payload/charge and time, and keeps
incoming payment and outgoing refund evidence distinct even when their IDs match.
Missing payload, incomplete pages, mismatches and conflicting evidence stay explicit.
A short final page never proves complete historical coverage. Missing ledger evidence
never proves a refund failed. No payment, grant, account or expiry is changed and no
refund is retried. Applying a recovery still requires shared reviewed commerce
transitions and a defined recovered grant-time policy; report-only output cannot
satisfy that production-readiness gate. Tests use synthetic files/injected responses:

```sh
node --test tools/test-vpn-stars-ledger-report.mjs
```


## Owner-approved Stars rollout — 2026-10-27

The owner approved the shown checkout, explicitly requested payment publication,
and selected300/800/1500/2700 XTR for30/90/180/365 days. The canonical one-time
catalogue is `services/vpn/approved-stars-plans.json`. This approval supersedes the
older preview/price hold above. Website YooKassa totals remain separately
300/780/1380/2400 RUB. Existing orders retain their saved amount and provider.

Use the established immutable runtime rollout with a fresh quiesced database/config
backup and compare migration before opening the API. Both unprivileged processes
must be able to read the nonsecret, root-owned catalogue in the immutable release;
do not put it in a root0600 credential path. Set the existing Stars enable/approval
flags and catalogue path explicitly, then reload the API and the single Telegram
consumer. Preserve all current sessions, account rights, payment records, bot token,
YooKassa configuration and worker offset. A rollback first disables new Stars sales
and retains financial processing plus the current database. Never restore an old
whole database over purchases or credentials created after rollout.

Read-only Bot API identity, empty-webhook and Stars-balance capability checks are
provider checks, not proof of a completed charge, refund or withdrawal. Offline
handler/HTTP tests cover exact prices, consent, precheckout-without-grant, successful
payment replay, provider isolation and refund isolation. Genuine TEST settlement
was unavailable at login; record that validation limit honestly when publishing.
The receiving API needs no extra payment-provider token; withdrawal eligibility and
net proceeds remain separate from receiving Stars. Public terms distinguish both
payment methods, and the per-purchase consent version is2026-10-27.2.

Operational recovery: if the bot misses an outage window or a refund has an
uncertain outcome, disable new Stars invoices while keeping the financial consumer
running. Retain the current database and private incident evidence. Take a consistent
same-host backup and run the bounded ledger report with the exact bot identity.
Review its matching order, direction, actor/amount and saved charge/grant consistency;
partial or absent ledger evidence never authorizes a refund retry or a grant.
Escalate a confirmed mismatch for a scoped operator repair using the existing shared
commerce transition and fresh invariants; this report tool has no automatic apply
mode. Do not mark an order recovered merely because a report was generated, accept
an unverified screenshot as payment proof, or replay any ambiguous refund.
