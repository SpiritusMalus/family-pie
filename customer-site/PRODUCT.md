# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
Family Spy is a separate customer website at `family-spy.ru` for Family VPN and Sufler only. Visitors can understand each service, see its price or pricing destination, inspect instructions and terms, and continue through the existing download, purchase or account flow. The homepage offers help with connection and setup. It does not carry the owner's portfolio, photograph, biography or employer contact links.

## Capabilities and Constraints
The storefront is static HTML/CSS/JavaScript. `tools/build-customer-site.mjs` generates `customer-site/dist` from this homepage and the existing `site/vpn`, `site/sufler` and `site/i18n` sources. Generated product copies remove employer-profile footer links, rebrand the customer shell and preserve product styling, downloads, instructions and legal content. Edit source or the builder rather than generated output. The Family Pie portfolio and its root PRODUCT.md/DESIGN.md remain separate.

The homepage supports RU/EN through the existing `fp_lang` preference and shared language API. RU is its first-visit default; an explicit language URL or saved choice wins. Relative navigation carries the selected language. Default Russian copy, instructions, terms and pricing destinations remain usable without JavaScript. VPN legal pages retain their established Russian text. The storefront is always black and does not alter the products' existing theme system. A customer-only style correction stacks VPN tariffs at 420px and below to avoid clipping the original discount rows.

Family VPN offers the existing subscription, device instructions and support in its account area. Sufler provides short prompts during calls for Windows and Mac; listening starts with a button and speech recognition requires the customer's own Deepgram key. Its existing trial is 30 minutes. Product setup pages retain their current prerequisites and data disclosures; the storefront does not establish new native-app acceptance.

`customer.js` requests only two fixed, public, read-only plan routes with no-store caching: `/public-plans/vpn` maps to `https://family-pie.ru/vpn/api/plans`; `/public-plans/sufler` maps to `https://hub.146-103-120-137.sslip.io/sufler-license/billing/plan`. VPN rendering requires an available, non-test, positive 30-day plan; Sufler rendering requires an enabled positive RUB plan with valid duration. If fetching or validation fails, the homepage retains account/service pricing copy and working links instead of inventing a price. Last confirmed public-plan evidence in this task was VPN 300 RUB for 30 days and Sufler 990 RUB for 30 days; these are observations, not fixed frontend promises.

Authenticated `/vpn/cabinet` and `/vpn/admin` routes, plus `/sufler/buy` purchase and recovery subroutes, retain the established `family-pie.ru` origin. The local preview redirects them there with their query string, preserving the existing cookie, passkey and payment-recovery boundary. Those application directories are excluded from the generated storefront. The copied VPN service worker and manifest are removed for this origin. There is no backend authentication/CORS migration, database migration or new credential issuance in this scope.

## Brand Commitments
Use the owner-approved black/Golos/coral visual language for a direct two-service offer. Keep the promise practical: help connecting, setting up and checking settings. It is not a refund, uptime, anonymity, security certification or SLA promise. VPN help continues through its cabinet; Sufler help uses the existing `support@family-pie.ru` address. Visitors are told not to send passwords, their Deepgram key or call recordings.

Preserve established terms, privacy notices and operator/seller facts. A shell rebrand does not rename the legal operator or establish a legal audit. Do not invent customer evidence, app screenshots or commercial claims.

## Evidence on Hand
The source homepage contains the two actual service descriptions, a reusable VPN portal Canvas and an explicitly labelled Sufler example prompt. The example demonstrates the form of a response; it is not a native screenshot or a promise that the application produced that exact answer. Local font files and existing product pages are reused. The homepage links to both products' terms and privacy pages before payment.

The local preview is served by `tools/serve-customer-site.mjs`, defaulting to `http://localhost:8133/`. Its read-only plan proxy and origin-preserving redirects are defined in source. This documentation pass inspected source only; it does not establish production routing, rendered acceptance or native-device behavior. Under the Family Pie AGENTS.md preview gate, publication remains held until the owner explicitly approves the actual shown render. Internal review and passing checks do not replace that approval.
