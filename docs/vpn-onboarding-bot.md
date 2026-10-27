# Family VPN first connection and Telegram service

This change is prepared for rendered-preview review. It is not publication approval.
The website and native bot share account, order, entitlement and provisioning state.
Website RUB/YooKassa payments and Telegram Stars payments remain separate providers.

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
node tools/build-vpn-bot-preview.mjs
```

The self-contained bot review artifact is `docs/preview/bot/index.html`. It is
generated from actual handlers and an injected sender with fictional accounts;
buttons illustrate the actual messages and do not operate the production bot.
Prepared avatar and metadata are review assets; generating them does not change
BotFather settings. The protected local fixture has separate paid, unpaid, expired,
legacy-unlimited, preparing and failed-provisioning roles. External merchant,
Telegram transport, SMTP and panel boundaries are synthetic. Its credentials and
raw proof are excluded from source publication and preserved separately.

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
