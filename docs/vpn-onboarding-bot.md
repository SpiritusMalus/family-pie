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

This work does not change DNS, VPN transport, IP allocation, client identities,
MSS/PMTU, retention safeguards, legacy-unlimited access or device limits. Existing
subscription delivery incidents remain separate prerequisites for final real-device
acceptance. No physical-phone, live payment or production delivery claim follows
from the synthetic preview checks.
