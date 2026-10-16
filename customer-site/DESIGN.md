---
name: Family Spy — customer storefront
description: Black Golos Text storefront for Family VPN and Sufler, with coral actions and preserved product identities.
colors:
  paper: "#000"
  ink: "#f3f4f5"
  quiet: "#b4bdc6"
  rule: "#41464c"
  accent: "#ff9d88"
  screen-field: "#101215"
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
  screen-caption:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  provenance:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  language-control:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
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

This document governs the customer storefront sources and their generated customer product pages. The builder replaces the VPN landing artwork and Sufler mock prompt with the corresponding interface captures; the remaining product UI keeps its established styling. `product-brand.css` styles those evidence figures and stacks VPN tariffs in one column at 420px and below, where the original two-column discount rows overflowed. The repository-root DESIGN.md remains the portfolio's separate authority.

**Key Characteristics:**
- Fixed black canvas, one coral action color and local Golos Text.
- Independent product sections with text beside media and a direct product action.
- Actual VPN cabinet captures from a demo account and source-rendered Sufler interface captures from a prepared interview.
- Inspectable full-size images and manually selectable, click-start finite demonstrations.
- RU/EN copy and compact controls with visible keyboard focus.

## Colors

### Primary

- **Storefront Coral** (`accent`) identifies each product's primary button, support destinations, demo playback action and focus outline.

### Neutral

- **Black Canvas** (`paper`) is the page background and primary button ink. The homepage has no light-theme control.
- **Primary Ink** (`ink`) carries headings, navigation and product-purpose lines; **Quiet Text** (`quiet`) carries descriptions, prices, labels, legal links and the footer.
- **Thin Rule** (`rule`) separates the header, full-width product sections and footer, and frames the screenshot links.
- **Screen Field** (`screen-field`) fills the screenshot frame around contained interface captures. Product colors stay inside their own images.

## Typography

Display, body and the `family-spy` wordmark use local Golos Text from `/vpn/fonts.css`, with a sans-serif fallback. Headings are semibold, closely tracked and balanced; body copy keeps an open inherited line height.

The display token serves each product name, fixed at 36px at 420px and below. The support heading uses headline; its product subheadings use subheading. Each product's purpose uses lead and remains 20px on mobile. Descriptions and support copy use body and are bounded to 65ch. The page-level Family Spy h1 is visually hidden; there is no visible combined offer heading.

Screenshot descriptions use screen-caption; provenance and full-size links use provenance. Demo controls are 14px, language controls use the existing language-control size, legal links are 14px and the footer is 13px. Both product figures have descriptions and provenance captions. These media and control roles do not replace the body hierarchy. Screenshot text belongs to the captured product UI, rather than a new storefront type scale.

## Layout

The centered container is `min(1100px, calc(100% - 80px))`. Total horizontal inset becomes 48px at 900px, 40px at 700px and 32px at 420px. These correspond to side gutters of 40, 24, 20 and 16px.

The desktop header is one row with an 80px minimum height: brand left, Family VPN/Sufler/Help anchor navigation and language controls right. At 700px it becomes a two-row grid, with the navigation spanning the lower row. The first visible offer is Family VPN; Sufler follows in its own section. There is no shared introduction, service-choice CTA or side-by-side catalog grid.

Each desktop product section uses text/media columns of `.78fr 1.35fr`, a 48px gap and 64px vertical padding. At 900px it becomes one column with a 28px gap and 48px padding; its media is at most 760px wide. At 700px the section has a 16px gap and 40px padding. Mobile CSS places title → purpose → price → actions → media before the remaining descriptive, setup and legal copy. The DOM retains the product copy followed by its figure. Screenshot links keep a 10:7 frame and contain the entire image without cropping. Product copy has no enclosing card padding. Desktop price lines have a 24px minimum height and 24px top margin; action and legal rows follow with a 16px top margin. Mobile price spacing reduces to 4px and action, setup and legal top margins reset.

Support has its own heading and separate VPN/Sufler articles in equal columns with a 64px gap, reduced to 32px at 900px. At 700px the articles become one column with a 28px gap. The shared privacy reminder follows them. The footer contains only the brand text and copyright, aligned apart on desktop and stacked at 700px. Product and support anchor destinations have a 24px scroll margin.

## Elevation & Depth

The shell is flat: no card shadows, glass or floating chrome. Section rules and framed screenshots establish separation. The storefront has no continuously animated media. Demos start only on click, advance through three still frames at three-second intervals, and stop after nine seconds. Hidden tabs stop playback; reduced motion replaces timed playback with a manual next-screen action and disables smooth page scrolling.

## Shapes

Screenshot frames and primary buttons share the small panel radius. Both screenshot frames have a thin border and contain the full capture. Full-width product sections use a bottom rule rather than an enclosing card. The compact header brand combines text with a 26px outlined circular SVG; it is not a portrait or personal badge. Other links and language controls stay unboxed.

## Components

**Primary actions.** Each product has its own coral button with black text, medium weight and a 48px minimum height. VPN links to its service and plans; Sufler links to download and trial. Account/setup links sit beside the relevant primary action. Hover follows the shared underline treatment; no scale, lift or glow is added.

**Navigation and language.** Header, brand, language, product-action, legal and support controls have a 44px minimum hit height; primary buttons retain 48px. Language buttons also have a 44px minimum width; the selected language uses primary ink and an underline 6px below the text. The toggle is revealed by JavaScript, while default RU content remains readable without it. Header links target `#vpn`, `#sufler` and `#support` directly.

**Product sections.** Each section keeps its name, independent purpose, dynamic price, product actions and terms/privacy links together. VPN media shows Android and Windows connection instructions and support in the actual cabinet using a demo account. Sufler media shows start, interviewer question and talking points in the application interface, rendered from source with a prepared interview. Provenance stays visible, including that the captured interface is Russian in either storefront language.

**Screenshot demonstrations.** Each homepage figure starts still, supports manual frame selection and opens the selected original image through both the image link and a labelled full-size link. Selected steps use primary ink and an underline, with `aria-pressed` state. The coral playback control starts a finite three-frame sequence, toggles to pause while playing and stops after nine seconds. Manual selection, a hidden tab, reduced-motion preference change or an image failure stops playback. Reduced motion uses a manual next-screen control. Descriptions announce changes politely. Controls are hidden without JavaScript; the initial image, provenance and original-image links remain usable. A failed image reveals a message pointing to its original; selecting another frame provides another recovery path. Generated product landings show a static capture and provenance with a link to the original image.

**Product support.** Separate titled articles describe a connection problem for VPN and an audio problem for Sufler. Each has its own existing support destination. The shared note asks visitors not to send passwords, their Deepgram key or a call recording.

**Links and focus.** Links underline on hover with a 4px offset. Keyboard focus uses a 2px coral outline with a 5px offset. The skip link becomes visible on focus. Support links use coral; secondary product destinations use primary ink and legal destinations use quiet text.

## Do's and Don'ts

- **Do** apply this shell to the customer storefront and keep generated product identities intact.
- **Do** keep each product's purpose, price, actions and legal links together in its own section.
- **Do** keep screenshot provenance, full-size inspection and manual controls readable on mobile.
- **Do** start demos only after a click and honor reduced motion and hidden-tab stops.
- **Do** show prices from the public service source or leave the useful pricing destination visible.
- **Don't** add the portfolio's portrait, biography, employer links or job-contact section to this surface.
- **Don't** introduce a combined headline, shared purchase CTA or visual bundle of the two independent products.
- **Don't** present prepared interview captures as live audio recognition, native-device acceptance, customer evidence or guaranteed results.
- **Don't** apply the storefront stylesheet across existing cabinet, purchase or product interfaces.
