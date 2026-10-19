---
name: "Family Spy — customer storefront"
description: "Black and graphite Golos Text storefront for independent Family VPN and Sufler offers, with coral emphasis and connected surfaces."
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
  ambient-coral: "#ff9d881a"
  icon-glow: "#ff9d8844"
typography:
  display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(72px, 11vw, 128px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
  display-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(64px, 18vw, 96px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.04em"
  display-mobile-vpn:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "1.28em"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(36px, 4.5vw, 56px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  benefits-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  product-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(56px, 7vw, 80px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  product-title-narrow:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  support-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  support-subheading:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  feature-title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "17px"
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
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  plan-monthly-compact:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  purpose:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.45
  purpose-mobile:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.45
  product-purpose:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.6
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
    lineHeight: 1.4
rounded:
  panels: "6px"
  screen-inner: "4px"
spacing:
  small: "8px"
  control: "12px"
  compact: "16px"
  copy: "20px"
  content: "24px"
  section-gap: "32px"
  column-gap: "40px"
  heading-gap: "48px"
  benefits-start: "56px"
  section-compact: "64px"
  section-mobile: "72px"
  section-tablet: "80px"
  pricing-start: "88px"
  section: "96px"
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
    padding: "16px"
  account-action:
    textColor: "{colors.ink}"
    rounded: "{rounded.panels}"
    padding: "12px 20px"
  pricing-comparator:
    backgroundColor: "{colors.screen-field}"
    rounded: "{rounded.panels}"
  plan-best:
    backgroundColor: "{colors.action-hover}"
---

# Design System: Family Spy

## Overview

**Creative North Star: "Two Independent Product Stages"**

The customer storefront keeps the owner-approved black canvas, local Golos Text and coral actions. A broad graphite opening and connected comparison surface give related content a clear material boundary. Large product names, a compact capability band and small rectangular controls make each independent offer readable; actual product imagery retains its own appearance.

This document owns the customer storefront's implemented visual system. The direction comment in customer-site/index.html and its surface brief own the homepage composition. Generated VPN and Sufler pages retain their established product UI, legal content and operational flows; product-brand.css supplies only the customer-specific adjustments. The repository-root DESIGN.md and .impeccable/design.json remain the portfolio's separate authority.

**Key Characteristics:**

- Black canvas and graphite fields, one coral emphasis family and local Golos Text.
- Broad uppercase VPN lockup on desktop, stacked on mobile, with the VPN word in coral.
- Connected capability band and pricing comparator, followed by quiet unboxed device destinations.
- Deliberate inline Sufler image stage, RU/EN controls and visible keyboard focus.

## Colors

The black canvas alternates with graphite fields. Coral identifies the VPN word, primary actions and selected value; it also supplies a static ambient presence. The frontmatter is normative.

### Primary

- **Storefront Coral** (`accent`) marks the hero's VPN word, primary actions, positive savings, the validated best-price label, capability icons, support links and focus outlines.
- **Hover Coral** (`accent-hover`) brightens filled actions on hover-capable devices.
- **Ambient Coral** (`ambient-coral`) is the static hero light; **Icon Glow** (`icon-glow`) is the limited capability-icon hover filter.

### Neutral

- **Black Canvas** (`paper`) is the page background and filled-action ink. There is no homepage theme control.
- **Primary Ink** (`ink`) carries product names, purpose copy, section headings and navigation; **Quiet Text** (`quiet`) carries secondary details, the live price and footer text.
- **Quiet Rule** (`rule`) organizes the header, capability band, comparator cells, product sections and footer.
- **Graphite Field** (`screen-field`) supplies the full-width VPN hero, contiguous pricing comparator and Sufler image surround.
- **Action Rule** (`action-rule`) outlines the account and non-featured tariff actions. **Warm Comparison Field** (`action-hover`) fills the best offer and non-featured action hover state.

**The Customer Scope Rule.** Use the storefront palette on the customer shell; preserve the existing product palettes and the separate portfolio authority.

## Typography

**Display and Body Font:** local Golos Text from `/vpn/fonts.css`, with a sans-serif fallback. The Family Spy wordmark uses the same family.

The desktop VPN name is a broad, bold, uppercase single-line lockup. The VPN word uses coral. At 700px and below the name stacks; its second word scales by the relative mobile VPN token. Section and Sufler headings are semibold, while purpose and body copy remain regular. The page-level Family Spy h1 stays visually hidden. There is no visible combined-offer heading.

The `display`, `display-mobile` and `display-mobile-vpn` roles govern the VPN name. `headline` serves pricing and device section headings; `benefits-title` serves the smaller capability-band heading. `product-title` serves Sufler, with the narrow override at 420px. Support has its own title and subheading roles. Capability titles use `feature-title`, reducing only on the narrowest layout.

The `purpose` and `purpose-mobile` roles serve VPN's primary-ink sentence. Sufler uses `product-purpose` with the inherited body line height, reducing to 20px on mobile. The VPN live price uses the body size. `plan-title` and its mobile role identify durations. `plan-monthly` provides the large monthly amount, reducing through `plan-monthly-compact` at 1050px and below. Numeric prices use tabular figures. Wide-screen RUB totals use the body size and USD estimates use `label`; mobile uses label-sized RUB totals and small USD estimates. Units and savings use `label`; footer uses `small`; languages and the exploration cue use `language-control`. The best label is 12px with a 24px line height on desktop and uses `best-label-mobile` on mobile. Existing action typography and responsive sizes remain component-specific.

## Layout

The main element spans the viewport, allowing the hero field to reach both edges. The header, capabilities, pricing, devices, Sufler, support and footer each own their centered container. Its width is `min(1100px, calc(100% - 80px))`, with side gutters of 40px on wide screens, 24px at 900px, 20px at 700px and 16px at 420px. The desktop header has an 80px minimum height. At 700px it becomes a two-row grid with brand and languages above the full navigation row.

The full-width graphite introduction centers its signal, broad name, purpose, live price and plan/account actions. Desktop minimum height is `min(720px, calc(100svh - 80px))`, with 64px top and 88px bottom padding; its horizontal padding follows the 1100px content width. Mobile switches to `calc(100svh - 120px)`, stacked type and narrower padding. The signal is 88px wide on desktop and 56px on mobile. Static ambient coral sits toward the field's upper left. The exploration anchor stays near the bottom and hides at viewport heights of 720px or less; short viewports also reduce vertical padding.

The capability section starts 56px after the hero. Its compact four-column band uses shared top and bottom rules, zero grid gap and quiet internal dividers. Each cell places a line icon beside a short heading. At 900px it becomes a two-by-two band with the lower row divided horizontally; at 420px the icon moves above its heading within the same connected structure. Section padding reduces to 48px at 900px.

Pricing begins 88px after the band section, reducing to 72px at 900px and 64px at 700px. All four offers share a graphite comparator with a thin outer border, small corners and zero column gap. Quiet internal lines divide cells; the best offer uses a warm field. Offer cells use 32px top, 24px side and 24px bottom padding, with a 300px minimum body height and bottom-aligned actions. At 1050px side padding reduces to 20px. At 900px the shared comparator becomes two-by-two, keeping the same body minimum so all actions align. At 600px it becomes one native disclosure list with 20px cell insets and no minimum body height. At 420px and below, the monthly amount and its unit each span the cost grid; the RUB total and approximate USD amount share the third row. The RUB total has a 12px top margin, and both totals stay on one line.

Six unboxed platform links follow in a tighter section, with 72px top and 64px bottom padding. Their grid uses six columns, three at 900px and two at 420px. Each destination has a centered icon and label with a 96px minimum target height, reducing to 88px on the narrowest layout. Device-section padding reduces to 64px at 900px and 56px at 700px.

Sufler has a separate `.7fr 1.3fr` text/image grid, 48px gap and 96px vertical padding. Its large title balances the actual capture in a graphite surround. At 900px the section stacks with a 40px gap and 80px padding; at 700px these become 32px and 72px. The image stage is at most 760px wide on the stacked layout. The surround has 16px padding, reducing to 12px at 420px. The inner capture uses its actual `760/560` aspect ratio, with the full image contained.

Support retains two columns with a 64px gap, reduced to 32px at 900px and stacked at 700px. The footer remains one support-email link beneath a thin rule. Product/support anchors retain 24px scroll margins; capability and pricing destinations use 40px. Breakpoint and motion details live in the customer-owned sidecar.

## Elevation & Depth

The main structure uses tonal fields and internal rules without raised pricing cards, glass or floating chrome. The hero's radial coral light is static, behind content and non-interactive. Sufler's actual image receives a contained shadow inside its graphite stage; that media depth does not spread to the comparator or capabilities. On hover-capable devices, capability icons retain their limited drop-shadow while device icons and actions change color or background. State transitions last 180ms only when reduced motion is not requested; reduced motion also disables smooth scrolling. There is no autoplay or animated ambient background.

**The Grouped Surface Rule.** Group related offers in one quiet field, use thin internal divisions and reserve image depth for the Sufler capture.

## Shapes

Primary, account and tariff actions, the shared comparator and the Sufler surround use the small panel radius from the frontmatter. The inner screenshot uses the smaller screen radius. Controls remain rectangular. The coral signal and existing outlined circular Family Spy SVG are icons, not a pill-control system. The capability band has shared horizontal rules and cell divisions but no individually boxed tiles. Device destinations remain unboxed. The pricing outer border contains all offers; internal lines divide them and the best offer changes its field rather than adding a coral top edge. Other navigation, languages and support links remain unboxed.

## Components

**Primary and account actions.** Primary actions use coral fill, black text, medium weight and a 52px minimum height. The VPN primary action scrolls to pricing. Its separate account action uses a quiet outline, small corners and the same minimum height, with its established cabinet destination. Sufler keeps exactly one action, Download and try, into `/sufler/#download`. Hover-capable devices use the lighter coral primary fill; account hover changes its arrow color. Actions do not scale or lift.

**Navigation and language.** The header retains the Family Spy mark, direct VPN/Sufler/Help anchors and RU/EN controls. Navigation and languages have 44px minimum targets; languages also have 44px minimum widths. Selected language uses primary ink and an underline offset by 6px. JavaScript reveals the language buttons; default Russian copy and links remain available without it.

**Capabilities.** The connected band contains four concise factual headings and consistent Tabler line icons with a 1.6 stroke. Icons are coral without individual border or fill. Their limited hover glow does not make the factual content clickable; content keeps a default cursor.

**Pricing.** Native details contain all four 30/90/180/365-day offers inside the shared comparison field. With JavaScript, desktop keeps every offer open and removes summaries from tab order; mobile at 600px and below begins with 30 days open and uses an exclusive `vpn-offers` group. At most one mobile offer is open; the native control may also close it. Returning to desktop opens all offers, while the last selected duration is retained for a later mobile layout. Without JavaScript all offers are initially open and useful account-pricing links remain visible.

Each validated amount supplies the monthly equivalent, full RUB total and approximate USD total. Positive absolute savings use the available 30-day base; missing base pricing omits savings. Best treatment requires multiple validated offers and a non-base lowest monthly offer. It uses the factual label, warm cell field and filled action. No popularity badge or manufactured discount is added. Product data rules and the dated exchange reference are recorded in PRODUCT.md; their explanatory paragraphs are not marketing copy.

**Device links.** Android, iPhone/iPad, Windows, macOS, Linux and Smart TV continue to the existing cabinet instructions and retain the selected platform through sign-in. Each unboxed link keeps its large target. Decorative arrows remain hidden.

**Inline product evidence.** The homepage shows the static Sufler answer capture inside its padded stage, with translated figure label and alt text. Its image is not a link. Load failure shows the existing short recovery text, and a later successful load restores the image. There are no screenshot selectors, provenance paragraphs, enlargement actions or separate viewers. Generated VPN and Sufler landings retain their static inline evidence images and established product context.

**Support and footer.** Separate named articles retain the existing VPN cabinet-support destination and Sufler mail destination with practical connection/audio help copy. The footer contains only the existing `support@family-pie.ru` mail link. Removed reminders and footer legal navigation do not return; product legal pages remain reachable through their established flows.

**Links and focus.** Text links underline on hover with a 4px offset. Keyboard focus on links, buttons and summaries uses a 2px coral outline with a 5px offset. The skip link becomes visible on focus. Support links use coral, account text uses primary ink and price details quiet text.

## Do's and Don'ts

### Do:

- **Do** preserve black, graphite, Golos Text, coral emphasis and the existing Family Spy mark.
- **Do** keep each independent offer and its next action clear; the homepage footer contains only the support email.
- **Do** keep all four plan destinations, validated dynamic amounts and useful price fallback.
- **Do** use native mobile disclosures and retain readable initially open offers without JavaScript.
- **Do** retain inline Sufler imagery, translated alt text, image recovery and visible focus.
- **Do** preserve the existing product, download, account, setup, legal and support destinations.

### Don't:

- **Don't** turn the customer shell into the portfolio or introduce a joint subscription or bundle claim.
- **Don't** replace the established rectangular controls with pills or borrow the reference site's coffee-shop identity.
- **Don't** fragment the connected comparator into detached cards or restore stepped tariffs and boxed device tiles.
- **Don't** add autoplay, moving ambient effects, invented screenshots, customer evidence or product guarantees.
- **Don't** add screenshot-opening links, a modal, a viewer route or a new-tab image action.
- **Don't** apply the homepage stylesheet to the existing cabinet, payment or native interfaces.
