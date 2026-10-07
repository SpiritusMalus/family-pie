---
version: 1
slug: "site-driftora-subscription-index-html"
primary_target: "site/driftora/subscription/index.html"
related_targets: ["route:/driftora/subscription/", "site/driftora/subscription/style.css", "site/home.css", "site/home-theme.js", "site/vpn/fonts.css", "site/vpn/portal.js", "site/i18n/language.js", "site/driftora/subscription/done.html"]
---

# Driftora subscription

## Scope and visitor mode

**Persuade.** The bilingual RU/EN purchase page explains why daily AI food analyses cost money, lets visitors choose a duration, and starts card checkout. The owner requested the homepage and `/vpn/` appearance for this surface. Product limits, payment behavior, refund terms and seller details remain governed by the existing service copy and backend.

## Direction and memorable moment

Extend the incumbent portal identity: local Golos Text, compact Family Pie wordmark, dark panels and warm foreground, coral actions, thin borders, decorative red edge lighting and the shared light alternative. Root `DESIGN.md` and `site/home.css` are the shared visual authorities; the subscription stylesheet supplies only this surface's composition and purchase controls.

On desktop, a large sentence-case headline explains “pay only for AI analyses” beside a transparent adaptive portal canvas. Five duration cards follow in one row, with visible server prices and an accent border on the chosen plan. On mobile the canvas is hidden so the service explanation and purchase controls take priority.

## Content and actions

- Explain the one-time allowance of 30 free AI analyses per device and the paid daily allowance of 30. Separate paid analyses from permanently free journal, weight, mood, steps and manual entry. Retain the five-device statement and the existing activation guidance.
- Offer monthly, 60-day, 90-day, 180-day and yearly durations. Load prices, payment enablement and receipt-email requirements from `https://food.family-pie.ru/billing/plans`; calculate monthly equivalents and savings from that response. Do not hardcode prices or discounts.
- Show the email field only when the backend requires it for the receipt. The main action includes the chosen price and posts the plan and email to `/billing/checkout`, stores the returned payment ID for the return page, then follows the provider confirmation URL. Return destination is `/driftora/subscription/done`.
- Keep the card-payment and no-auto-renewal notice directly below checkout. The expandable key-recovery area accepts the payment ID from the receipt and queries `/billing/license`; recovered keys are selectable text.
- Follow with paid/free feature lists, native expandable FAQs, service/delivery/refund/seller terms, legal document links and support contact. Without JavaScript the Russian service and legal descriptions remain in the HTML; prices remain placeholders and checkout stays disabled.

## Behavior and constraints

The duration selector is a radio group. Click changes selection; arrow keys cycle visible plans, and Home/End select the first/last. Selected borders and soft accent fill carry state, with a visible accent focus outline. Plans absent from a nonempty backend response are hidden. Checkout remains disabled while plans load, when payment is unavailable, or while the request is busy; email validation and request failures use the existing localized messages.

The shared theme script defaults to dark and persists `family-vpn-theme-v3`, updating both root/body classes, pressed state and color scheme. Both themes use immediate background changes. The adaptive canvas redraws on theme changes and inherits the portal renderer's reduced-motion, visibility and pixel-budget protections. The language controls use the shared `FPi18n` preference and update content, metadata, accessible labels, prices and asynchronous copy.

Panels have 6px corners; inputs and checkout controls have 3px corners. The plan grid changes from five columns to three at 1000px, then two at 720px with the final plan spanning the row. At 720px the paid/free columns stack and portal art disappears. Shared homepage gutters and header controls remain responsive. Reduced motion removes CSS transitions; form focus remains visible.

## Verification and unresolved decisions

Acceptance checks: desktop/mobile composition; readable dark/light states and persistent preference; full RU/EN copy; keyboard plan selection; backend-loaded amounts and savings; receipt-email visibility; loading/disabled/busy/error states; key-recovery responses; retained no-renewal, refund and seller facts; legal/home/support destinations; reduced-motion rendering. These describe implementation and acceptance criteria, not completed live-payment or browser verification.

No new visual direction remains open. Payment availability and actual provider fulfillment require separate backend verification; this appearance change does not establish a new price, subscription entitlement or release claim.
