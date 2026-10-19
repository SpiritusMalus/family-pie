---
name: "Family Spy — customer storefront"
description: "Black Golos Text storefront for independent Family VPN and Sufler offers, with coral actions and quiet boundaries."
colors:
  paper: "#000"
  ink: "#f3f4f5"
  quiet: "#b4bdc6"
  rule: "#292d32"
  accent: "#ff9d88"
  accent-hover: "#ffb39f"
  screen-field: "#101215"
  action-rule: "#53575d"
  action-hover: "#241b18"
  ambient-coral: "#ff9d8810"
  icon-glow: "#ff9d8844"
typography:
  display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(72px, 10.4vw, 144px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  display-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(72px, 16vw, 104px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(36px, 4.5vw, 56px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  product-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(48px, 5.5vw, 72px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  support-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  feature-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  feature-title-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  feature-title-narrow:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  plan-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  plan-title-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  plan-monthly:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  plan-monthly-compact:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  plan-monthly-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  purpose:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.5
  purpose-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  language-control:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  best-label-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  panels: "6px"
spacing:
  small: "8px"
  control: "12px"
  compact: "16px"
  copy: "20px"
  content: "24px"
  plan-gap: "28px"
  section-gap: "32px"
  column-gap: "40px"
  heading-gap: "48px"
  product-gap: "64px"
  section-mobile: "72px"
  section-tablet: "80px"
  benefits-start: "100px"
  device-end: "104px"
  section: "120px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.panels}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  plan-action:
    textColor: "{colors.ink}"
    rounded: "{rounded.panels}"
    padding: "12px"
  plan-action-best:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.panels}"
    padding: "12px"
  language-button:
    textColor: "{colors.quiet}"
    padding: "8px"
  language-button-selected:
    textColor: "{colors.ink}"
    padding: "8px"
  support-link:
    textColor: "{colors.accent}"
  screen-frame:
    backgroundColor: "{colors.screen-field}"
    rounded: "{rounded.panels}"
---

# Design System: Family Spy

## Overview

**Creative North Star: "Two Independent Product Stages"**

The customer storefront keeps the owner-approved black canvas, local Golos Text and coral actions. Large, tightly set names and generous empty space give each independent product a clear offer. Small rectangular controls, quiet rules and open content keep the shell direct; actual product imagery retains its own appearance.

This document owns the customer storefront's implemented visual system. The direction comment in customer-site/index.html and its surface brief own the homepage composition. Generated VPN and Sufler pages retain their established product UI, legal content and operational flows; product-brand.css supplies only the customer-specific adjustments. The repository-root DESIGN.md and .impeccable/design.json remain the portfolio's separate authority.

**Key Characteristics:**
- Fixed black canvas, one coral action family and local Golos Text.
- Large product typography, generous spacing and small rectangular actions.
- Open capabilities, thin-rule pricing and unboxed device destinations.
- Inline product captures, RU/EN controls and visible keyboard focus.

## Colors

The palette keeps the storefront black and quiet, with coral marking actions and a restrained ambient presence. The frontmatter is normative.

### Primary

- **Storefront Coral** (`accent`) marks primary actions, positive savings, the validated best-plan treatment, capability icons, support links and focus outlines.
- **Hover Coral** (`accent-hover`) brightens filled actions on hover-capable devices.
- **Ambient Coral** (`ambient-coral`) is the faint static hero light; **Icon Glow** (`icon-glow`) is the limited capability-icon hover filter.

### Neutral

- **Black Canvas** (`paper`) is the homepage background and filled-action ink. There is no homepage theme control.
- **Primary Ink** (`ink`) carries product names, section headings and navigation; **Quiet Text** (`quiet`) carries secondary copy, price details and footer text.
- **Quiet Rule** (`rule`) separates the header, product sections and footer and supplies each tariff's top edge.
- **Screen Field** (`screen-field`) fills the inline Sufler frame around the contained capture.
- **Action Rule** (`action-rule`) outlines non-featured tariff actions; **Action Hover** (`action-hover`) gives those links a dark coral hover field.

**The Customer Scope Rule.** Use the storefront palette on the customer shell; preserve the existing product palettes and the separate portfolio authority.

## Typography

**Display and Body Font:** local Golos Text from `/vpn/fonts.css`, with a sans-serif fallback. The Family Spy wordmark uses the same family.

The VPN name is bold, tightly tracked and deliberately split into two lines. Section and Sufler headings are semibold; factual body copy remains regular with an open line height. The page-level Family Spy h1 is visually hidden. No additional visible combined-offer heading is present.

The `display` and `display-mobile` roles serve the VPN name. `headline` serves capability, pricing and device section headings. `product-title` serves Sufler and reaches its minimum on narrow screens. `support-title` serves the support heading. Capability titles use `feature-title`, reducing through its two mobile roles; support article titles retain the existing 20px semibold heading treatment. Purpose copy uses the purpose roles for VPN; Sufler's purpose retains the body line height and reduces to the feature-title size on mobile.

`plan-title` and its mobile role identify durations. The three monthly roles keep numeric emphasis across the wide, compact-desktop and mobile layouts. Numeric prices use tabular figures. Totals, units and savings use `label`; USD estimates and footer use `small`; language and exploration controls use `language-control`. The best-price label uses that small control size on desktop and `best-label-mobile` on mobile. Tariff actions are small on wide screens, compact-control sized below the narrow-desktop breakpoint, and label-sized in the two-column and mobile layouts.

## Layout

The centered container is `min(1100px, calc(100% - 80px))`. Side gutters are 40px on wide screens, 24px at 900px, 20px at 700px and 16px at 420px. The desktop header has an 80px minimum height. At 700px it becomes a two-row grid with brand and languages above the full navigation row.

The VPN introduction is centered and fills at least the viewport minus the header. It uses `100svh` and a desktop minimum of `calc(100svh - 80px)`, changing to `calc(100svh - 120px)` on mobile. A static signal mark leads the two-line product name, purpose, public price and plan/account actions. Content starts below the introduction. The small exploration anchor sits near its bottom and is hidden when viewport height is at most 720px; the intro then uses reduced vertical padding.

Capabilities have four open columns with a 40px gap, becoming two columns with a 32px gap at 900px. They retain two columns on narrow screens, with smaller heading type and compact gaps. The later pricing row uses four equal-width, top-rule offers and a 28px gap; at 900px it becomes two columns. At 600px it becomes a single native disclosure list. Each wide-screen offer has the same minimum body height and a bottom-aligned action. No stepped offsets or enclosing pricing cards remain.

Six unboxed platform links follow pricing. Their grid uses six columns on desktop, three at 900px and two at 420px. Each destination has a centered platform icon and label. Wide targets have a 112px minimum height, reducing to 100px on the narrowest layout.

Sufler retains its separate text/image section: `.78fr 1.35fr` columns, 64px gap and 120px vertical padding. At 900px it stacks with an image width of at most 760px; padding reduces to 80px, then 72px at 700px. Its copy is limited to the name, single purpose phrase, price/trial and one download action. The static answer capture follows in the DOM and keeps its 10:7 frame with the full image contained.

Support uses two columns with a 64px gap, reduced to 32px at 900px and stacked at 700px. The footer remains one support-email link beneath a thin rule. Product/support anchors retain 24px scroll margins; capability and pricing destinations use 40px. Breakpoint and motion details live in the customer-owned sidecar.

## Elevation & Depth

The shell has no card shadows, glass or floating chrome. Spacing, thin boundaries and typographic contrast provide structure. The hero's radial coral light is static, behind its content and non-interactive. On hover-capable devices, only capability icons receive the existing subtle drop-shadow; platform icons and actions change color or background. There is no automatic playback or animated ambient background. State transitions last 180ms only when reduced motion is not requested; reduced motion also disables smooth scrolling.

**The Flat Boundary Rule.** Use spacing and thin rules to organize offers; keep ambient light static and avoid raised card surfaces.

## Shapes

Primary actions, tariff actions and screenshot frames use the small panel radius from the frontmatter. They remain rectangular, matching the small-corner geometry of the selected composition reference. The coral signal mark and existing outlined circular Family Spy SVG are icons, not a pill-control system. Capabilities and platform links have no enclosing panel or icon-box background. Tariffs have only a top rule, with the last mobile tariff also closing the list with a bottom rule. Best pricing changes that top rule to coral. Other navigation, language and support links remain unboxed.

## Components

**Primary actions.** Coral fill, black text, medium weight and a 52px minimum height. The VPN action scrolls to pricing; its separate account link retains the existing cabinet destination. Sufler has exactly one action, Download and try, into `/sufler/#download`. Hover-capable devices use the lighter coral fill. Actions do not scale or lift.

**Navigation and language.** The header retains the Family Spy mark, direct VPN/Sufler/Help anchors and RU/EN controls. Navigation and languages have 44px minimum targets; languages also have 44px minimum widths. Selected language uses primary ink and an underline offset by 6px. JavaScript reveals the language buttons; default Russian copy and links remain available without it.

**Capabilities.** Four concise factual headings and consistent Tabler line icons describe the existing offer. The icons use a 1.6 stroke. Their wrapper supplies layout space, without a border or colored fill. Content has a default cursor. The limited icon glow is a hover response, not evidence of clickability.

**Pricing.** Native details contain the four 30/90/180/365-day offers. With JavaScript, desktop keeps every offer open and removes summaries from tab order; mobile at 600px and below begins with 30 days open and uses an exclusive `vpn-offers` group. At most one mobile offer is open; the native control may also close it. Switching back to desktop opens all offers, while the last chosen duration is retained for a later mobile layout. Without JavaScript all offers are initially open and useful account-pricing links remain visible.

Each validated amount supplies the monthly equivalent, full RUB total and approximate USD total. Positive absolute savings use the available 30-day base; missing base pricing omits savings. The best treatment requires multiple validated offers and a non-base lowest monthly offer. It uses the factual label, coral top rule and filled action. No popularity badge or manufactured discount is added. Product data rules and the dated exchange reference are recorded in PRODUCT.md; their explanatory paragraphs are not marketing copy.

**Device links.** Android, iPhone/iPad, Windows, macOS, Linux and Smart TV continue to the existing cabinet instructions and retain the chosen platform through sign-in. Each unboxed link keeps a large hit area. Decorative arrows remain hidden in the implemented layout.

**Inline product evidence.** The homepage shows only the static Sufler answer capture, with translated figure label and alt text. Its image is not a link. Load failure shows the existing short recovery text and a later successful load restores the image. There are no screenshot selectors, provenance paragraphs, enlargement actions or separate viewers on the homepage. Generated VPN and Sufler landings retain their static inline evidence images and existing product context.

**Support and footer.** Separate named articles retain the existing VPN cabinet-support destination and Sufler mail destination. They keep practical connection/audio help copy. The footer contains only the existing `support@family-pie.ru` mail link. The removed reminder and footer legal navigation do not return; product legal pages remain reachable through their existing product flows.

**Links and focus.** Text links underline on hover with a 4px offset. Keyboard focus on links, buttons and summaries uses a 2px coral outline with a 5px offset. The skip link becomes visible on focus. Support links use coral, account links primary ink and price details quiet text.

## Do's and Don'ts

### Do:

- **Do** preserve black, Golos Text, coral actions and the existing Family Spy mark.
- **Do** keep each independent offer and its next action clear; the homepage footer contains only the support email.
- **Do** keep all four plan destinations, validated dynamic amounts and useful price fallback.
- **Do** use native mobile disclosures and retain readable initially open offers without JavaScript.
- **Do** retain inline Sufler imagery, translated alt text, image recovery and visible focus.
- **Do** preserve the existing product, download, account, setup, legal and support destinations.

### Don't:

- **Don't** turn the customer shell into the portfolio or introduce a joint subscription or bundle claim.
- **Don't** replace the established rectangular controls with pills or borrow the reference site's coffee-shop identity.
- **Don't** reintroduce stepped tariffs, enclosing capability panels or boxed device tiles into this homepage composition.
- **Don't** add autoplay, moving ambient effects, invented screenshots, customer evidence or product guarantees.
- **Don't** add screenshot-opening links, a modal, a viewer route or a new-tab image action.
- **Don't** apply the homepage stylesheet to the existing cabinet, payment or native interfaces.
