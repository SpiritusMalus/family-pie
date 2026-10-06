---
version: 1
slug: "site-vpn-cabinet-index-html"
primary_target: "site/vpn/cabinet/index.html"
related_targets: ["route:/vpn/cabinet/", "route:/vpn/cabinet/auth/", "route:/vpn/admin/", "site/vpn/cabinet/auth/index.html", "site/vpn/admin/index.html", "site/vpn/cabinet-ui.js", "site/vpn/account.js", "site/vpn/app.js", "site/vpn/style.css", "site/vpn/portal-style.css", "site/vpn/fonts.css", "services/vpn/auth.mjs", "services/vpn/cabinet.mjs"]
---

# Family VPN cabinet, authentication and administration

## Scope and visitor mode

**Operate.** A returning family member checks access, imports a personal connection, manages an account or asks for help; an administrator manages access, billing and replies. This functional extension inherits the approved dark/red portal world. It does not redesign the landing, studio homepage or global visual system.

Success is a clear task → truthful state → actionable next step. Account creation is distinct from payment confirmation, and confirmed payment is distinct from settings applied on VPN. Never offer a connection before the account has active, synchronized access.

## Direction and memorable moment

Inherit `DESIGN.md` and the implemented `portal-style.css`: dark grounds, warm light text, coral actions, cool thin borders, compact corners, local Golos Text and the compact Unbounded wordmark. Cabinet edge lighting stays subdued and pointer transparent. The light preference retains the same structure and darker red actions. No new palette, display face, hero artwork or motion on account data is introduced.

The overview's first useful moment is the subscription panel: expiry or existing unlimited family access, application state, then the personal connection action and expandable owned QR. Nearby numbered instructions make the next step concrete. Preserve desktop sidebar navigation and its active marker; on mobile it becomes a horizontal scroller with a bottom active marker. Stack panels, wrap action groups and administrative fields, and keep ordinary vertical page scrolling. Authentication pairs concise introductory copy with its form on desktop and stacks them on mobile. Administration uses section anchors above readable task panels.

## Content, actions and states

- **Authentication:** login/password, self-registration with repeated password and consent, temporary-password replacement, and native passkey login are implemented. Preserve labelled fields, autocomplete, required validation and mismatch feedback. Passkey controls reflect browser support. Google and email-code journeys are prepared but provider configuration is missing; hide unavailable entry methods and explain their absence in settings. Do not present them as connected.
- **Overview and devices:** distinguish awaiting payment, payment confirmed but applying, applied, suspended and application error. Copy, Happ import and private QR are available only for active synchronized access. Subscription QR is owned account data and carries a privacy notice; invitation QR is a separate public sharing action. Device guides remain accessible and route selection happens in the VPN application.
- **Subscription and payment:** render service-provided durations, prices and limits; allow a period, receipt email and promo selection. Checkout transfers to ЮKassa for card/SBP payment without automatic recurring charges. Orders expose pending, paid, canceled and refunded states, with a check action for pending orders. Server-confirmed payment precedes provisioning; a return from checkout alone is not success. The gateway reuses the owner-authorized Sufler merchant, while VPN tariffs await approval. Empty tariff lists and unavailable checkout must explain that payment is not enabled and no money is charged. Existing unlimited family access intentionally disables renewal checkout.
- **Friends:** show the owned invitation link/QR, registered and paid counts, and configured bonus policy. Rewards remain off until enabled; do not turn invitation tracking into a promised cash bonus. When enabled, show balance, minimum withdrawal and pending/paid/declined requests; refunds reverse the relevant bonus.
- **Support:** persisted thread list, empty state, subject/body creation, chronological user/admin messages, attachment links and open/closed/reopened states. The reply form appears for open threads. Keep file-type/size feedback and distinguish a sent message from a failed attachment. Ask users to omit their private VPN key.
- **News:** published account news, empty state and read acknowledgement. The user's news preference persists in the account and controls navigation visibility.
- **Settings:** saved display name and receipt email; passkey add/list/remove; prepared Google/email linking; current/other sessions and termination; password setup with recent reauthentication; browser-local theme; Telegram link/pending confirmation/linked/paused/unavailable states; permission-dependent push and device removal; browser installation instructions. Permission refusal and unavailable provider controls remain clear operational states.
- **Diagnostics:** report browser-to-server HTTP delay, jitter and test-transfer speeds. Address evidence may say whether this request came from the configured exit, or that it cannot be determined. Never label these results ICMP or proof that every VPN route works.
- **Administrator:** user creation, search, expiry/access changes and subscription removal/restoration; separately visible VPN application state. Existing unlimited access is preserved, with ineligible unlimited controls intentionally disabled. Add tariff/promo forms, order/refund handling, support replies, news draft/publication editing and referral policy/withdrawal handling. Refunds require confirmation. A payout marked paid records an administrator's completed transfer with evidence; it does not execute a bank transfer.

## Behavior and constraints

Retain route hashes, selected navigation, keyboard focus, skip link, hidden-screen behavior, dark/light preference and reduced-motion support. Async actions disable their submitting control while running, restore it afterward and surface status/error feedback through live status regions. Preserve entered values when correction is needed; unavailable and legacy-only disabled controls are intentional safeguards, not unfinished decorative buttons.

Use actual API state for account facts; no invented prices, payment confirmation, network health or private subscription URLs in fixtures, documentation or public markup. Root `PRODUCT.md` and `DESIGN.md` still contain historical demonstration/disconnected-function language. This brief records the current cabinet implementation and supplied release constraints without rewriting those files; implementation is not evidence of production enablement.

## Evidence and unresolved decisions

Source basis: cabinet/auth/admin HTML, `cabinet-ui.js`, `account.js`, base styles and portal overrides, inspected on 2026-10-06. Synthetic fixture captures live under `/Users/malum/myprojects/VPN/design/cabinet-2026-10-06/` for auth, overview, plans, support, settings and admin on desktop/mobile. Their accounts, messages and prices are demonstrations; captures establish layout evidence, not real payments, authenticated production operation or VPN traffic.

Open release decisions are tariff approval and provider configuration for Google/email, plus actual production availability of payment, push and other configured integrations. Acceptance must verify authorization, persisted edits, errors, payment/provisioning separation, private QR ownership, keyboard routes, mobile scroller, both themes and intentional disabled states. This document does not claim those live checks or a deployment.
