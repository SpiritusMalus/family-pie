---
name: Family Spy — customer storefront
description: Black Golos Text storefront for Family VPN and Sufler, with coral actions and preserved product identities.
colors:
  paper: "#000"
  ink: "#f3f4f5"
  quiet: "#b4bdc6"
  rule: "#41464c"
  accent: "#ff9d88"
  vpn-cover: "#090d13"
  sufler-cover: "#101215"
typography:
  display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(36px, 4.2vw, 54px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  lead:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  price:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  cover-caption:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.6
  example-question:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.35
  example-answer:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  panels: "6px"
spacing:
  compact: "16px"
  mobile-content: "20px"
  content: "24px"
  product-gap: "28px"
  header-gap: "32px"
  section-end: "56px"
  section-start: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.panels}"
    padding: "12px 22px"
  language-button:
    textColor: "{colors.quiet}"
    padding: "8px"
  language-button-selected:
    textColor: "{colors.ink}"
    padding: "8px"
  text-link:
    textColor: "{colors.accent}"
  product-copy:
    padding: "24px"
---

# Design System: Family Spy

## Overview

**Creative North Star: "The Two-Service Storefront"**

The customer homepage adapts the owner-approved black, Golos Text and coral composition into a compact storefront. A direct offer precedes two equal product covers and practical setup help. Thin neutral rules and sentence-case type carry the page; the products supply its imagery.

This document governs `customer-site/index.html` and `customer-site/customer.css`. Generated VPN and Sufler pages retain their existing product UI. `product-brand.css` changes the customer shell and stacks VPN tariffs in one column at 420px and below, where the original two-column discount rows overflowed. The repository-root DESIGN.md remains the portfolio's separate authority.

**Key Characteristics:**
- Fixed black canvas, one coral action color and local Golos Text.
- Equal image-first product cards with direct service and setup actions.
- Existing VPN portal artwork and a clearly labelled Sufler prompt example.
- RU/EN copy and compact controls with visible keyboard focus.

## Colors

### Primary

- **Storefront Coral** (`accent`) identifies the primary button, product actions, support destinations and focus outline. The Sufler example uses it for its speaker label.

### Neutral

- **Black Canvas** (`paper`) is the page background and primary button ink. The homepage has no light-theme control.
- **Primary Ink** (`ink`) carries headings, navigation and body copy; **Quiet Text** (`quiet`) carries the introduction, prices, labels and footer.
- **Thin Rule** (`rule`) frames product cards and separates the header, example answer, support and footer.
- **Product Cover Fields** (`vpn-cover`, `sufler-cover`) remain local media backgrounds. Portal glow is artwork, not another shell accent.

## Typography

Display, body and the `family-spy` wordmark use local Golos Text from `/vpn/fonts.css`, with a sans-serif fallback. Headings are semibold, closely tracked and balanced; body copy keeps an open inherited line height.

The display token serves the offer. Product and support headings use the headline token. Introductory copy uses lead; service copy uses body and is bounded to 65ch. The lead becomes 18px at 700px. At 420px the display is fixed at 36px.

The VPN cover caption stays fixed at 20px, including compact screens. The Sufler example question reduces to 18px at 900px and 16px at 420px; its answer reduces to 16px at 900px. Example labels are 13px, then 12px at 420px. Language controls are 12px and the footer is 13px. These media and control roles do not replace the body hierarchy.

## Layout

The centered container is `min(1100px, calc(100% - 80px))`. Total horizontal inset becomes 48px at 900px, 40px at 700px and 32px at 420px. These correspond to side gutters of 40, 24, 20 and 16px.

The desktop header is one row with an 80px minimum height: brand left, Services/Help navigation and language controls right. At 700px it becomes a two-row grid, with the navigation spanning the lower row. The introduction has 64px/56px vertical padding, a 900px bound and an 800px heading bound; its padding reduces to 44px at 900px and 36px/40px at 700px.

Products occupy equal columns with a 28px gap, reduced to 20px at 900px. At 700px they stack in VPN → Sufler order with a 28px gap. Covers use 16:9; at 420px and below they use a 216px minimum height instead, keeping the example readable. Product copy is padded 24px, then 20px at 420px. Price rows have a 45px minimum height and sit above the actions at the bottom of each card.

Setup help uses a 1.3fr/1fr split and 64px gap, reduced to 32px at 900px. At 700px it becomes one column with a 20px gap. The footer wraps on desktop and becomes a vertical stack at 700px. Anchor destinations have a 24px scroll margin.

## Elevation & Depth

The shell is flat: no card shadows, glass or floating chrome. Borders and contrasting cover fields establish separation. Depth stays inside the existing VPN Canvas artwork. Its renderer caps pixel ratio at 2, stops continuous frames while offscreen or hidden, and renders a still composition for reduced motion. Reduced motion also disables smooth page scrolling.

## Shapes

Product panels and the primary button share the small panel radius. Product panels clip their covers within a thin border. The compact brand combines text with a 26px outlined circular SVG; it is not a portrait or personal badge. Other links and language controls stay unboxed.

## Components

**Primary action.** A coral button with black text, medium weight and a 48px minimum height. It moves the visitor to the service choice. Hover follows the shared underline treatment; no scale, lift or glow is added.

**Navigation and language.** Header, brand, language, service-action, support and footer controls have a 44px minimum hit height. Language buttons also have a 44px minimum width; the selected language uses primary ink and an underline 6px below the text. The toggle is revealed by JavaScript, while default RU content remains readable without it.

**Product cards.** Two equal bordered panels place cover, title, short description, price and direct actions in that order. The VPN cover reuses `/vpn/portal.js`. The Sufler cover is authored text headed “Example prompt,” with a question, thin rule and answer. It is not presented as a native application screenshot.

**Links and focus.** Links underline on hover with a 4px offset. Keyboard focus uses a 2px coral outline with a 5px offset. The skip link becomes visible on focus. Inline product and support links use coral; secondary destinations retain the surrounding text color.

## Do's and Don'ts

- **Do** apply this shell to the customer storefront and keep generated product identities intact.
- **Do** retain the fixed cover caption, readable mobile example and existing reduced-motion behavior.
- **Do** show prices from the public service source or leave the useful pricing destination visible.
- **Don't** add the portfolio's portrait, biography, employer links or job-contact section to this surface.
- **Don't** turn the illustrative prompt into purported app evidence or invent testimonials, results or service guarantees.
- **Don't** apply the storefront stylesheet across existing cabinet, purchase or product interfaces.
