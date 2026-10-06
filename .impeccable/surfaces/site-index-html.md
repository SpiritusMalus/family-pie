---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["route:/", "data/products.json"]
---

# Family Pie studio homepage

## Scope and visitor mode

The studio's bilingual RU/EN product directory at `/`. Visitors browse the portfolio, expand a product to understand its purpose, then follow its working destination. Adding Family VPN extends this existing surface; it does not establish a new visual identity.

## Direction and memorable moment

Preserve the incumbent cream studio layout, dark text, green studio accents, typographic hierarchy, numbered accordion rows, and compact navigation. VPN belongs in the same product list and interaction pattern as the existing four products. Its familiar red identity comes from `/vpn/favicon.svg`, displayed as the product image against its dark icon container; do not recolor the studio around VPN.

Keep Driftora, ReLo Dojo, Rest Lumen, and Sufler in their existing order, content, and behavior. Append Family VPN as product `05`; the product count is also `05`. The expanded fifth row is the recognizable moment: the VPN icon, concise capabilities, and a clear path to the VPN landing page.

## Content and actions

- Navigation includes a visible `VPN` link to `/vpn/` alongside the existing products link and RU/EN switch.
- The fifth accordion row describes the personal account, subscription duration, and Telegram reminders in both languages. Its primary action reads `Открыть VPN` / `Open VPN` and opens `/vpn/`.
- Public payment remains unavailable: both descriptions explicitly say checkout is still being prepared. Do not imply immediate purchase or show store download controls for VPN.
- Preserve the existing catalog mechanism: `data/products.json` and the inline `CATALOG` mirror in `site/index.html` agree. The no-JavaScript fallback includes a real bilingual Family VPN link.

## Behavior and constraints

Inherit the existing accordion, keyboard focus, responsive layout, language persistence, and reduced-motion behavior. The fifth row follows the same accessible expanded-state control as its neighbors; switching language updates its description, features, and action together. Navigation and expanded VPN action must reach the same `/vpn/` destination on desktop and mobile.

This brief is homepage-specific authority. Root `DESIGN.md` and `PRODUCT.md` describe separate VPN work and are not authority for replacing the studio homepage. No global design tokens or new components are introduced here.

## Verification and unresolved decisions

Acceptance checks: five correctly ordered rows and `05` count; existing four products retained; VPN navigation and row action work; red favicon loads; RU/EN content stays complete; mobile controls do not overflow; public-payment wording stays honest; no-JavaScript destination remains usable.

No new homepage design decision remains open. Payment enablement belongs to the VPN service release and must be verified separately before homepage copy promises purchase.
