---
name: Family VPN — Red portal
scope: studio homepage and /vpn/
colors:
  background: "#090d13"
  foreground: "#f1eee7"
  muted: "#a5b0ba"
  primary: "#ff746c"
  surface: "#131b24"
  line: "#303942"
typography:
  display:
    fontFamily: "Golos Text, sans-serif"
  body:
    fontFamily: "Golos Text, sans-serif"
rounded:
  controls: "3px"
  panels: "6px"
---
## Selected direction
Owner selected the original dark/red portal preview after comparing bold, minimal and dark technology concepts. The full landing, authentication preview and every cabinet route share this identity. The owner extended this identity to the studio homepage on 2026-10-06. Individual product landing pages retain their own identities.

## Typography and composition
Cyrillic Golos Text headlines are large, sentence case and asymmetric. Existing licensed fonts remain local; Unbounded is restricted to the compact family/vpn wordmark. A canvas portal balances the landing headline and action. Red edge light is decorative, pointer transparent and reduced in the cabinet. Settings retain a readable light alternative with the same shape system and a darker red accent.

## Motion
Original Canvas light arcs provide depth and a gentle pointer response. The renderer honours reduced-motion, bounds pixel ratio to2 and pauses when offscreen or the document is hidden. No film assets, literal weapon or connection-diagram hero. No animation on cabinet data or primary tasks.

## Shared components
The VPN uses portal-style.css after its base stylesheet; the studio homepage uses home.css with the same tokens and reuses /vpn/fonts.css and /vpn/portal.js. Dark theme v3 is the new default; owner preference persists after changing it. Controls use3px corners, panels6px, thin cool borders, warm white text and coral red actions. Subscription and referral cards use the same dark surface rather than changing section theme. Existing sidebar, tabs, field IDs, route focus and demo states remain.

## Truth and release scope
This is a visual revision of the explicitly public demonstration. Identity, billing, subscription provisioning, personal referral accounting and sent support are still disconnected. Do not invent prices, real connection status or customer evidence. Roll back via the scoped PR and established Family Pie CI deployment.

## Author voice
The owner is the sole developer. Studio-homepage copy uses first-person singular (я / I), with an independent-developer label; do not imply a team in RU/EN. Product/legal entities and their business details remain governed by the existing sources.

## Website language
All HTML entry points share `fp_lang` through `/i18n/language.js`. Explicit app-fragment language takes precedence, then `?lang=`, saved preference, and browser language. Keep RU/EN controls keyboard-accessible and preserve the selection across product/legal/purchase/account navigation.

Russian-first pages opt into `data-fp-translate`; reviewed English copy lives in `/i18n/en.js`. Translation updates text nodes and accessibility/metadata attributes, preserving markup, form values and application behavior. Include new static copy and asynchronous states in the map; use `FPi18n.t()` for clipboard text and native dialogs. Exclude user-provided text with `data-fp-no-i18n`. Native bilingual renderers use the shared preference directly. Setup instructions may quote the app's actual Russian control names next to English explanations. UI localization does not change product legal/business facts or external app/payment-provider interfaces.

## Homepage appearance and navigation
The original six-slice pie geometry uses neutral theme surfaces, muted outlines and one coral/red segment on the homepage. VPN is one catalog product: do not duplicate its link in the header or hero. Light homepage appearance includes the root/background and an adaptive red portal on a transparent canvas; avoid a dark rectangular art tile. The shared portal opts into the light palette via `data-portal-theme="adaptive"` and redraws on `family-themechange`, including reduced motion.
Canvas observation resumes on a persisted `pageshow` after cached back navigation; `pagehide` stops frames/observers without discarding theme listeners needed on return.

## Lumen + REST product surface
`/rest_lumen/` inherits local Golos Text typography, the compact Unbounded studio wordmark, and the shared geometry: controls 3px, panels 6px. Its own dark background is `#0d1014`, with warm ivory text and a warm `#f1c27d` action accent; these product-specific colors do not replace the homepage/VPN palette.

The owner selected an AI-generated photographic fabric lamp in a dark room after rejecting the flat render. Preserve believable fabric, physical light and shadows in `site/rest_lumen/assets/lamp-room.jpg`; softly masked image edges blend into the page background. The lamp button toggles an illustrative page-only on/off state with `aria-pressed`, keyboard activation and visible focus. It does not control the visitor's display. Reduced motion removes image/button transitions and smooth scrolling.

Keep the responsive reading order: product purpose and download action → lamp → actual macOS settings and reminder screenshots → platform downloads and honest beta limitations. Preserve the real screenshots and all six existing release-package links. RU/EN copy and accessibility labels use the shared `fp_lang` preference and reviewed `/i18n/en.js` keys.
