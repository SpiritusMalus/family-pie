---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["route:/", "data/products.json", "site/home.css", "site/home-theme.js"]
---

# Family Pie studio homepage

## Scope and visitor mode

The studio's bilingual RU/EN product directory at `/`. Visitors browse the portfolio, expand a product to understand its purpose, then follow its working destination. Adding Family VPN extends this existing surface; it does not establish a new visual identity.

## Direction and memorable moment

Preserve the integrated, owner-selected Family VPN portal identity: dark surfaces, warm light text, coral red actions and edge lighting, local Golos Text typography, a compact Unbounded wordmark, and a canvas portal beside the studio introduction. `site/home.css` is the homepage's visual implementation authority; root `DESIGN.md` now covers both the studio homepage and `/vpn/`. The prior cream studio treatment is superseded.

The desktop first viewport pairs the studio headline and product action with portal artwork. Mobile stacks this composition and retains the hero's Family VPN link. Keep numbered accordion rows, restrained borders, compact controls, and the integrated dark/light theme switch. VPN belongs in the same product list and interaction pattern as the existing four products. Its red identity comes from `/vpn/favicon.svg`, displayed against its dark product icon container.

Keep Driftora, ReLo Dojo, Rest Lumen, and Sufler in their existing order, content, and behavior. Append Family VPN as product `05`; the product count is also `05`. The expanded fifth row is the recognizable moment: the VPN icon, concise capabilities, and a clear path to the VPN landing page.

## Content and actions

- Desktop navigation includes `Family VPN ↗` linking to `/vpn/`, the products link, theme control, and RU/EN switch. Below the existing mobile breakpoint the text navigation links are hidden; the hero's `Family VPN ↗` and expanded fifth row keep the VPN destination available.
- The fifth accordion row describes the personal account, subscription duration, and Telegram reminders in both languages. Its primary action reads `Открыть VPN` / `Open VPN` and opens `/vpn/`.
- Public payment remains unavailable: both descriptions explicitly say checkout is still being prepared. Do not imply immediate purchase or show store download controls for VPN.
- Preserve the existing catalog mechanism: `data/products.json` and the inline `CATALOG` mirror in `site/index.html` agree. The no-JavaScript fallback includes real Family VPN content, the Russian payment-unavailable statement, and a working `/vpn/` link.

## Behavior and constraints

Inherit the existing accordion, keyboard focus, responsive layout, language persistence, and reduced-motion behavior. The fifth row follows the same expanded-state control and collapsed-panel inert behavior as its neighbors; switching language updates its description, features, and action together. Desktop navigation, hero link, and expanded VPN action reach the same `/vpn/` destination.

`site/home-theme.js` owns theme behavior: dark is the default; the switch updates the light class, pressed state, document color scheme, and background. Preference persists under the shared `family-vpn-theme-v3` key so homepage and VPN respect the same choice. Keep both themes readable. The homepage reuses `/vpn/portal.js`; preserve its reduced-motion, visibility, and rendering-budget protections.

This brief records homepage composition and behavior within the shared visual system. Consult root `DESIGN.md` for durable visual rules; do not promote homepage catalog strategy into global product claims. The integrated styles and theme script supersede earlier cream-page guidance. This VPN catalog addition introduces no global tokens or replacement theme.

## Verification and unresolved decisions

Acceptance checks: five correctly ordered rows and `05` count; existing four products retained; desktop VPN navigation, hero link, and row action work; red favicon loads; RU/EN content stays complete; mobile controls do not overflow; both themes and saved preference work; public-payment wording stays honest; no-JavaScript destination remains usable. These are acceptance criteria, not a claim of completed browser verification.

No new homepage design decision remains open. Payment enablement belongs to the VPN service release and must be verified separately before homepage copy promises purchase.
