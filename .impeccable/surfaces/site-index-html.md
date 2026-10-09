---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["route:/","route:/work/driftora","route:/work/lumen-rest","site/work/driftora/index.html","site/work/lumen-rest/index.html","site/portfolio.css","site/portfolio-theme.js","site/portfolio.js","site/work/assets/driftora-review.png","site/rest_lumen/assets/settings-macos.png","site/rest_lumen/assets/reminder-macos.png","site/vpn/fonts.css","site/i18n/language.js"]
---

# Family Pie developer portfolio and work pages

## Scope and visitor mode

**Experience** at `/`: an employer meets Evgeny Tikhonenko, inspects Driftora and Lumen + REST, follows the implementation stories and reaches his contact destinations. The two `/work/` case pages support **Read** within the same portfolio world. The visible author voice is first-person singular in RU/EN.

This replaces the previous homepage catalog/portal surface. It does not change the customer-facing VPN, Lumen product, purchase, download or legal routes. `data/products.json` remains the complete product/legal catalog; the employer-facing work selection contains two applications.

## Direction and memorable moment

The built world is a neutral working-screen specimen: local Golos Text, flat light/dark paper and ink, restrained coral links, thin dividers and actual Android/macOS application images with adjacent explanations. `site/portfolio.css` is the visual implementation authority; `portfolio-theme.js` and `portfolio.js` own scoped appearance and native bilingual rendering. The old homepage's `home.css`, `home-theme.js`, catalog accordion and portal artwork no longer define this surface.

The homepage begins with the compact pie mark and `family-pie` wordmark, Evgeny's name and full-stack role. Driftora follows with his personal reason for the app, sole authorship, its technical stack, and a cropped review screen beside portion/source notes. Lumen follows with his reason for movement and eye-rest breaks, its consent-based timer behavior, platform stack and existing macOS settings screen. Contact closes the page with email, LinkedIn and GitHub.

On desktop, Driftora has copy left/media right and Lumen media left/copy right. Mobile stacks each project with copy before media. Work and Contact remain available in the header's second row beneath the brand and preference controls.

Both case pages begin with All work, the application name, purpose and stack. Narrative sits beside application media on desktop; media comes before the narrative on mobile. Driftora explains authorship, photo/draft/review/local-save flow, portion recalculation and nutrition-source attribution. Lumen explains motivation, break consent, screen restoration and separate platform integration. These are the built content structure, not global component rules.

## Content and actions

- Work and Contact point to the homepage sections from all three portfolio routes.
- Each homepage project links to its real case page: `/work/driftora/` and `/work/lumen-rest/`.
- Every displayed specimen has a visible `Открыть полный скриншот` / `View full screenshot` link with a 44px minimum height. It is an ordinary same-tab link to the original image; browser Back returns to the page. There is no lightbox or new-tab promise.
- The Driftora image is the existing composed Android store asset with text input, visibly labelled accordingly. It is not a new device capture or camera-flow acceptance evidence.
- Lumen uses the existing actual macOS settings and reminder images. These do not establish fresh physical-device or cross-platform acceptance.
- Case footers retain cross-project links and existing customer destinations: `/driftora/legal` and `/rest_lumen/`.
- Contact uses the existing email, LinkedIn and GitHub destinations. Personal motivations do not claim achieved weight loss or clinical benefit.

## Behavior and constraints

Use the built desktop/mobile grid, captions, full-image links and sticky desktop case media without inventing a carousel, modal or screenshot viewer. Screens remain native application evidence. Keep the two selected apps and readable explanations; the complete legal catalog stays separate.

`portfolio-theme.js` shares `family-vpn-theme-v3` with the site, honors a saved light/dark preference and otherwise follows system appearance. It updates pressed state and document color scheme, responds to storage and page-return events, and retains a complete palette in both appearances. Shared customer theme/style files remain unchanged. Without JavaScript, readable Russian copy and destination links remain available in the static dark fallback; preference controls are hidden.

RU/EN shares `fp_lang` and `/i18n/language.js`. Native `data-ru` / `data-en` rendering updates text and declared copy attributes; `fp-languagechange` updates selected buttons. Preserve the existing language selection across customer and legal navigation.

The only portfolio motion is the small arrow shift on case-link hover when reduced motion is not requested. Keyboard focus uses the accent outline; the skip link reaches the main content. Keep mobile navigation visible and screenshot links independently operable.

## Verification and unresolved decisions

The finish reviewer approved the replacement portfolio after the mobile Work/Contact row and the independently operable 44px full-screenshot links were resolved. This brief records that review status; it does not add browser, physical-device or deployment claims. Parent task evidence owns the exact checks and release receipt.

No material visual finding or design decision remains open in the reviewed portfolio. Existing customer release limitations remain separate and retain their own surface briefs.
