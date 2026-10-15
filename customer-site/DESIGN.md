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
  subheading:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
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
  support-link:
    textColor: "{colors.accent}"
---

# Design System: Family Spy

## Overview

**Creative North Star: "Two Independent Product Stages"**

The customer homepage adapts the owner-approved black, Golos Text and coral composition into consecutive, full-width product sections. Family VPN and Sufler each have their own name, factual purpose, price, primary action and legal links. Thin neutral rules and sentence-case type separate the offers; the products supply their own imagery.

This document governs `customer-site/index.html` and `customer-site/customer.css`. Generated VPN and Sufler pages retain their existing product UI. `product-brand.css` changes the customer shell and stacks VPN tariffs in one column at 420px and below, where the original two-column discount rows overflowed. The repository-root DESIGN.md remains the portfolio's separate authority.

**Key Characteristics:**
- Fixed black canvas, one coral action color and local Golos Text.
- Independent product sections with text beside media and a direct product action.
- Existing VPN portal artwork and a clearly labelled Sufler prompt example.
- RU/EN copy and compact controls with visible keyboard focus.

## Colors

### Primary

- **Storefront Coral** (`accent`) identifies each product's primary button, support destinations and focus outline. The Sufler example uses it for its speaker label.

### Neutral

- **Black Canvas** (`paper`) is the page background and primary button ink. The homepage has no light-theme control.
- **Primary Ink** (`ink`) carries headings, navigation and product-purpose lines; **Quiet Text** (`quiet`) carries descriptions, prices, labels, legal links and the footer.
- **Thin Rule** (`rule`) separates the header, full-width product sections, example answer and footer. It also frames the Sufler cover.
- **Product Cover Fields** (`vpn-cover`, `sufler-cover`) remain local media backgrounds. Portal glow is artwork, not another shell accent.

## Typography

Display, body and the `family-spy` wordmark use local Golos Text from `/vpn/fonts.css`, with a sans-serif fallback. Headings are semibold, closely tracked and balanced; body copy keeps an open inherited line height.

The display token serves each product name, fixed at 36px at 420px and below. The support heading uses headline; its product subheadings use subheading. Each product's purpose uses lead and remains 20px on mobile. Descriptions and support copy use body and are bounded to 65ch. The page-level Family Spy h1 is visually hidden; there is no visible combined offer heading.

The Sufler example question reduces to 18px at 900px and 16px at 420px; its answer reduces to 16px at 900px. Example labels are 13px, then 12px at 420px. Language controls are 12px, legal links are 14px and the footer is 13px. There is no separate VPN cover caption. These media and control roles do not replace the body hierarchy.

## Layout

The centered container is `min(1100px, calc(100% - 80px))`. Total horizontal inset becomes 48px at 900px, 40px at 700px and 32px at 420px. These correspond to side gutters of 40, 24, 20 and 16px.

The desktop header is one row with an 80px minimum height: brand left, Family VPN/Sufler/Help anchor navigation and language controls right. At 700px it becomes a two-row grid, with the navigation spanning the lower row. The first visible offer is Family VPN; Sufler follows in its own section. There is no shared introduction, service-choice CTA or side-by-side catalog grid.

Each product section has equal text/media columns, a 64px gap and 64px vertical padding. At 900px the gap becomes 32px and padding becomes 48px. At 700px the section becomes one column with a 28px gap and 40px padding; its copy stays before its media. Covers use 16:9; at 420px and below they use a 216px minimum height instead, keeping the example readable. The Sufler cover has 24px padding, then 20px at 900px and 16px at 420px. Product copy has no enclosing card padding. Price lines have a 24px minimum height and a 24px top margin; action and legal rows each follow with a 16px top margin.

Support has its own heading and separate VPN/Sufler articles in equal columns with a 64px gap, reduced to 32px at 900px. At 700px the articles become one column with a 28px gap. The shared privacy reminder follows them. The footer contains only the brand text and copyright, aligned apart on desktop and stacked at 700px. Product and support anchor destinations have a 24px scroll margin.

## Elevation & Depth

The shell is flat: no card shadows, glass or floating chrome. Section rules and contrasting cover fields establish separation. Depth stays inside the existing VPN Canvas artwork. Its renderer caps pixel ratio at 2, stops continuous frames while offscreen or hidden, and renders a still composition for reduced motion. Reduced motion also disables smooth page scrolling.

## Shapes

Product covers and primary buttons share the small panel radius. Covers clip their artwork; only the Sufler cover adds a thin border. Full-width product sections use a bottom rule rather than an enclosing card. The compact header brand combines text with a 26px outlined circular SVG; it is not a portrait or personal badge. Other links and language controls stay unboxed.

## Components

**Primary actions.** Each product has its own coral button with black text, medium weight and a 48px minimum height. VPN links to its service and plans; Sufler links to download and trial. Account/setup links sit beside the relevant primary action. Hover follows the shared underline treatment; no scale, lift or glow is added.

**Navigation and language.** Header, brand, language, product-action, legal and support controls have a 44px minimum hit height; primary buttons retain 48px. Language buttons also have a 44px minimum width; the selected language uses primary ink and an underline 6px below the text. The toggle is revealed by JavaScript, while default RU content remains readable without it. Header links target `#vpn`, `#sufler` and `#support` directly.

**Product sections.** Each section's copy presents its name, purpose, description, dynamic price, product actions and terms/privacy links. Media is a separate, non-clickable cover beside that copy. The VPN cover reuses `/vpn/portal.js`. The Sufler cover is authored text headed “Example prompt,” with a question, thin rule and answer. It is not presented as a native application screenshot.

**Product support.** Separate titled articles describe a connection problem for VPN and an audio problem for Sufler. Each has its own existing support destination. The shared note asks visitors not to send passwords, their Deepgram key or a call recording.

**Links and focus.** Links underline on hover with a 4px offset. Keyboard focus uses a 2px coral outline with a 5px offset. The skip link becomes visible on focus. Support links use coral; secondary product destinations use primary ink and legal destinations use quiet text.

## Do's and Don'ts

- **Do** apply this shell to the customer storefront and keep generated product identities intact.
- **Do** keep each product's purpose, price, actions and legal links together in its own section.
- **Do** retain the readable mobile example and existing reduced-motion behavior.
- **Do** show prices from the public service source or leave the useful pricing destination visible.
- **Don't** add the portfolio's portrait, biography, employer links or job-contact section to this surface.
- **Don't** introduce a combined headline, shared purchase CTA or visual bundle of the two independent products.
- **Don't** turn the illustrative prompt into purported app evidence or invent testimonials, results or service guarantees.
- **Don't** apply the storefront stylesheet across existing cabinet, purchase or product interfaces.


## Product appearance persistence — 2026-10-15
Customer product pages now load the same saved appearance before paint. Dark is the default and invalid-value fallback. An explicit VPN light selection also reaches Sufler's landing, setup, legal and payment/recovery pages, which now have a full dark palette and retain the prior light palette. Fixed-black storefront composition stays black without writing over that preference. Root-shared appearance.js/css are part of the generated customer artifact, including its 404 and cached offline page. Product layout, content, API/account/payment logic and download targets are unchanged.
