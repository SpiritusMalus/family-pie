---
name: Family Pie — working-screen portfolio
description: Neutral Golos Text portfolio with annotated application screens and preserved customer identities.
colors:
  paper: "#151719"
  ink: "#f3f4f5"
  quiet: "#b4bdc6"
  rule: "#41464c"
  accent: "#ff9d88"
  stage: "#202429"
  light-paper: "#fcfcfd"
  light-ink: "#20262e"
  light-quiet: "#56616d"
  light-rule: "#d7dce1"
  light-accent: "#b83321"
  light-stage: "#eef1f4"
  vpn-background: "#090d13"
  vpn-foreground: "#f1eee7"
  vpn-muted: "#a5b0ba"
  vpn-primary: "#ff746c"
  vpn-surface: "#131b24"
  vpn-line: "#303942"
  vpn-button-ink: "#261516"
  vpn-light-background: "#f7f6f3"
  vpn-light-foreground: "#202731"
  vpn-light-muted: "#59636d"
  vpn-light-primary: "#a52f32"
  vpn-light-surface: "#eeece8"
  vpn-light-line: "#d1ccc7"
  vpn-light-button-ink: "#fff"
  vpn-primary-hover: "#ff958e"
  vpn-light-primary-hover: "#87262a"
  lumen-paper: "#0d1014"
  lumen-muted: "#b7b0a3"
  lumen-line: "#34332f"
  lumen-primary: "#f1c27d"
  lumen-button-ink: "#21190f"
  lumen-surface: "#191c20"
  subscription-ok: "#8ed4ad"
  subscription-light-ok: "#286442"
typography:
  display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(38px, 5.2vw, 68px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(30px, 3.6vw, 46px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.65
  case-lead:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  caption:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
  showcase-display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "clamp(36px, 4.2vw, 54px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  showcase-compact-display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.12
  showcase-narrow-display:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.12
  showcase-summary:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.65
  showcase-body:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  showcase-heading:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.12
  showcase-caption:
    fontFamily: "Golos Text, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  customer-wordmark:
    fontFamily: "Unbounded, sans-serif"
    fontWeight: 600
rounded:
  controls: "3px"
  panels: "6px"
  screen: "14px"
  theme-control: "50%"
spacing:
  control-gap: "12px"
  proof-gap: "24px"
  contact-gap: "32px"
  page-gutter: "40px"
  mobile-gutter: "20px"
  compact-gutter: "16px"
  project-gap: "64px"
  case-gap: "80px"
components:
  theme-toggle:
    textColor: "{colors.ink}"
    rounded: "{rounded.theme-control}"
    padding: "8px"
    height: "44px"
    width: "44px"
  theme-toggle-light:
    textColor: "{colors.light-ink}"
    rounded: "{rounded.theme-control}"
    padding: "8px"
    height: "44px"
    width: "44px"
  language-button:
    textColor: "{colors.quiet}"
    padding: "8px"
    height: "44px"
    width: "44px"
  language-button-selected:
    textColor: "{colors.ink}"
    padding: "8px"
    height: "44px"
    width: "44px"
  text-link:
    textColor: "{colors.accent}"
  text-link-light:
    textColor: "{colors.light-accent}"
  screen-link:
    textColor: "{colors.accent}"
  screen-link-light:
    textColor: "{colors.light-accent}"
  screenshot-stage:
    backgroundColor: "{colors.stage}"
    padding: "28px"
  screenshot-stage-light:
    backgroundColor: "{colors.light-stage}"
    padding: "28px"
---

# Design System: Family Pie

## Overview

**Creative North Star: "The Working-Screen Specimen"**

The portfolio uses neutral surfaces, local Golos Text and restrained coral links to make actual applications easy to inspect. Large sentence-case headings and ample space separate the developer's voice from the application evidence. A cropped Android review screen sits beside short annotations; the macOS settings and reminder screens keep their native appearance.

Light and dark appearances share the same composition, rules and typography. Depth belongs to the application specimens; the surrounding page is flat, with thin dividers and direct text links. The six-slice Family Pie mark retains one coral segment, while its accompanying portfolio wordmark uses Golos Text.

**Key Characteristics:**
- Neutral page and specimen surfaces in complete light and dark appearances.
- Golos Text throughout the portfolio, including its compact wordmark.
- Actual application images with adjacent explanation, source labels and a path to the full image.
- Flat section boundaries, generous reading space and restrained link motion.

### Surface authority

The portfolio world applies to `/`, `/work/driftora/` and `/work/lumen-rest/`. Its implementation authority is `site/portfolio.css`, `site/portfolio-theme.js` and `site/portfolio.js`. The homepage and work-page composition are recorded in the existing portfolio surface brief; they are not a catalog template for other routes.

VPN retains the owner-selected original dark/red portal identity across its landing, authentication preview and cabinet. `site/vpn/portal-style.css` layers over its base stylesheet. `/driftora/subscription/` retains that customer portal identity through `site/home.css`, `site/home-theme.js` and its scoped purchase stylesheet. `/rest_lumen/` retains its own warm photographic identity. The shared customer styles and theme script are unchanged by the portfolio replacement.

The owner's visible author voice remains first-person singular in RU/EN. Product and legal entities stay governed by their existing sources. A visual design review does not establish identity, billing, provisioning, personal referral accounting or support acceptance. Real states and prices must come from existing service sources; do not invent them or customer evidence. Release and rollback use the scoped PR and established Family Pie CI route.

## Colors

The portfolio pairs neutral paper, ink and specimen surfaces with one coral accent. The unprefixed tokens above are the default dark values; `light-*` values are their complete light counterparts. Customer-prefixed tokens belong only to their named product surfaces.

### Primary

- **Portfolio Coral** (`accent` / `light-accent`) colors case links, full-image links, the pie segment and visible focus. Light appearance uses a deeper red to stay readable on the light paper.
- **Portal Coral** (`vpn-primary` / `vpn-light-primary`) remains the VPN and Driftora purchase action color. Its existing dark/light hover tokens remain customer-specific.
- **Lamp Amber** (`lumen-primary`) remains the warm action color on `/rest_lumen/`.

### Neutral

- **Paper and Ink** (`paper`, `ink`, `light-paper`, `light-ink`) form the portfolio canvas and primary text.
- **Quiet Text** (`quiet` / `light-quiet`) carries introductions, technical stacks, annotations and captions without fading the application evidence.
- **Thin Rule** (`rule` / `light-rule`) separates header, projects, contact and footer; it also frames the theme control and desktop screenshots.
- **Specimen Stage** (`stage` / `light-stage`) gives the Android crop a distinct neutral field.
- **Portal Neutrals** (`vpn-background`, `vpn-foreground`, `vpn-muted`, `vpn-surface`, `vpn-line` and their light counterparts) remain warm-white text, cool borders and dark or warm-light customer surfaces. Portal action text uses its dedicated ink tokens.
- **Lamp Neutrals** (`lumen-paper`, `lumen-muted`, `lumen-line`, `lumen-surface`, `lumen-button-ink`) stay local to the warm Lumen product page. Its warm ivory text continues to use the same value as `vpn-foreground`.

The Driftora purchase surface retains its separate dark/light free-feature markers (`subscription-ok` / `subscription-light-ok`). These markers do not introduce another portfolio accent.

**The Surface Palette Rule.** Apply a color family only to the surface that owns it. Sharing fonts or a stored preference does not merge the portfolio, portal and lamp palettes.

## Typography

**Display and Body Font:** local Golos Text, with sans-serif fallback. The portfolio loads the existing local font files through `/vpn/fonts.css` and uses regular, medium and semibold weights. Its compact `family-pie` wordmark is Golos Text, not Unbounded.

**Customer Wordmark Font:** local Unbounded remains restricted to compact Family/VPN and Lumen studio wordmarks on their existing customer surfaces.

The portfolio type is sentence case, closely tracked in headings and open in paragraphs. The hierarchy depends on size and spacing rather than extra font families, uppercase labels or ornamental badges.

### Hierarchy

- **Display:** the `display` token serves the developer or application name. At the mobile breakpoint it becomes (42px), then (36px) at the compact breakpoint.
- **Headline:** the `headline` token serves project and contact headings. Case-story headings use (30px), then (27px) on mobile.
- **Title:** the `title` token is the stylesheet's smaller heading role.
- **Body:** project and case paragraphs use the `body` token. Homepage project copy becomes (17px) on mobile; the introduction uses (21px) desktop and (18px) mobile. Case narrative is bounded to (70ch).
- **Case Lead:** the `case-lead` token introduces the application's purpose; it becomes (22px) on mobile.
- **Label and Caption:** technical stacks use the `label` token; image source labels use `caption`. Annotation size varies with specimen width, and remains part of the media composition rather than a new global scale.

**The Local Type Rule.** Use Golos Text for all portfolio text. Preserve Unbounded only on the existing customer wordmarks that already use it.

## Layout

The portfolio container is capped at (1180px), with (40px) side gutters on desktop, (20px) at widths up to (760px), and (16px) up to (420px). The desktop header is a single (90px minimum) row: brand on the left, Work/Contact and preference controls on the right. At (760px) it becomes a two-row grid: brand and controls above, Work and Contact below. The lower navigation row stays visible on mobile.

Homepage project rows sit between thin dividers. Driftora uses a text/media split of (1fr / 1.08fr) with a (64px) gap; Lumen uses (1.2fr / 1fr) and a (70px) gap, with media on the left. At (1000px) both gaps shrink to (36px). At (760px) the rows become one column, the Lumen copy returns before its image, and the gap is (30px).

The Android specimen pairs a fixed-ratio screen crop with brief side notes on a padded stage. Captions sit below their images and include an always-visible full-image link. Contact destinations wrap naturally, with enough vertical space to remain separate actions.

Case pages use narrative and media columns of (1fr / 0.75fr), an (80px) gap and a (70ch) narrative limit. The gap becomes (40px) at (1000px). Media is sticky only from (960px), with a (28px) top offset. At (760px), the case becomes one column with media before the implementation narrative and a (32px) gap.

### Preserved customer composition

VPN keeps its asymmetric portal landing composition, existing sidebar, tabs, route focus, field IDs and demo states. Its subscription and referral cards continue to use the same dark surface rather than switching section themes. Cabinet tasks retain their own readable layout and light alternative.

`/rest_lumen/` retains the order: product purpose and download action → lamp → actual macOS settings and reminder screens → platform downloads and honest beta limitations. Preserve all six existing release-package links.

`/driftora/subscription/` retains five server-priced plans in one desktop row and a two-column mobile grid with a full-width final plan. Existing bilingual service, refund and seller copy, receipt fields, checkout and key recovery remain intact.

## Elevation & Depth

The portfolio page is flat. Thin rules and tonal specimen stages provide structure; only application images receive small shadows. The Android crop uses `0 14px 30px #0002`; desktop screenshots use `0 16px 36px #0001`. The page has no portal canvas or decorative edge-light layer.

**The Specimen Depth Rule.** Keep the portfolio shell flat; use the existing image shadows to separate application evidence from its page.

### Preserved customer depth and motion

VPN's original Canvas light arcs retain their gentle pointer response. Red edge light is decorative, pointer-transparent and reduced in the cabinet. The renderer honors reduced motion, bounds pixel ratio to (2), and pauses while offscreen or hidden. No film assets, literal weapon or connection-diagram hero; no animation on cabinet data or primary tasks. Its shared portal retains adaptive light-palette support and redraws on `family-themechange`, including reduced motion. Canvas observation resumes on persisted `pageshow`; `pagehide` stops frames and observers without discarding theme listeners needed on return.

The explicitly requested VPN diagnostic is the existing exception: a CSS metal hilt and white/red glowing blade extend while the real HTTP network test runs; full ignition marks success only. It has no artificial measurement delay or percentage claim. Error stops/dims the blade, retry resets it, reduced motion removes interpolation, and hidden/offscreen views skip visual updates. Other cabinet surfaces retain their motion policy.

The Lumen product surface retains the owner-selected AI-generated photographic fabric lamp in `site/rest_lumen/assets/lamp-room.jpg`, with believable fabric, physical light and shadows. Softly masked image edges blend into its dark background. The separate transparent photographic wool pompom/cord cutout overlays the cleaned room image. Its projected shadow follows the gesture; the cord stretches while the wool ball keeps its proportions, and both return with the existing short spring curve. Preserve this product illustration independently of the portfolio's actual macOS screens.

## Shapes

Portfolio section boundaries and desktop image frames are square. The Android specimen is clipped to the `screen` radius at an aspect ratio of (760 / 1450); it crops the existing composed store asset rather than drawing a new device frame. The circular theme button uses the `theme-control` radius. Text links and language buttons have no enclosing capsule or filled card treatment. The six-slice pie mark remains a small outlined circle with one coral segment.

Customer geometry remains distinct: the established control radius is `controls`, the panel radius is `panels`, and thin cool borders remain part of the VPN and purchase identity. Lumen retains those shared control/panel radii within its own photographic and warm-color world.

## Components

### Portfolio links

Case links are medium-weight coral text with an inline (18px) arrow and a (44px) minimum height. When reduced motion is not requested, hover shifts the arrow (4px) over (.2s) with `cubic-bezier(.16,1,.3,1)`. The full-screenshot link is a separate coral text action, (14px) with a (44px) minimum height; it navigates to the existing image in the same tab. Browser Back returns to the portfolio. There is no lightbox.

All links and buttons retain the visible accent outline (3px) with a (5px) offset. The skip link becomes visible on focus and reaches the main content. Contact and back links remain ordinary working anchors. The attribution footer has no repeated social link; GitHub appears once in the homepage contact section.

### Portfolio preference controls and navigation

RU/EN controls are unfilled compact buttons. The selected language uses ink and an underline; the other language uses quiet text. The theme button is a thin-bordered circle with a moon in dark appearance and a sun in light appearance. Controls are (44px) at regular widths and (38px) at the compact breakpoint. The final mobile header keeps Work and Contact in its second row, with (38px) minimum height for these navigation links.

`portfolio-theme.js` shares the stored `family-vpn-theme-v3` key with the customer site, but implements the portfolio's own palette. Without a saved preference, JavaScript follows the system appearance. The choice updates the root light class, document color scheme and pressed state, persists when storage is available, and responds to storage, system and page-return changes. The static no-JavaScript fallback remains dark; preference controls are hidden, while copy and destination links remain available.

All entry points continue to share `fp_lang` through `/i18n/language.js`: explicit app-fragment language → `?lang=` → saved preference → browser language. Portfolio text and accessibility/metadata attributes use native `data-ru` / `data-en` copy, `data-copy-attr` where needed, and `portfolio.js`; the selected button updates on `fp-languagechange`.

Existing Russian-first customer pages retain `data-fp-translate` and reviewed `/i18n/en.js` keys. Translation preserves markup, form values and application behavior. Include asynchronous states in the map; use `FPi18n.t()` for clipboard text and native dialogs, and exclude user-provided text with `data-fp-no-i18n`. Native bilingual renderers use the shared preference directly. Setup instructions may quote actual Russian control names alongside English explanations. UI localization does not change legal/business facts or external application/payment interfaces.

### Application specimens

The homepage Android image is cropped to reading scale, with adjacent portion/source notes; the case reuses the same image at a larger width. Its caption identifies **Android, text input**. It is an existing composed store asset, not a fresh device capture or evidence of camera-flow acceptance. The macOS settings and reminder images are existing application screens, not new physical-device or cross-platform acceptance evidence. Each displayed image has a full-image link.

Keep captions attached to their images, preserve their native application appearance, and keep the source labels visible in RU/EN. No portfolio card, badge or decorative mock interface replaces an application screenshot.

### Preserved customer controls

VPN retains portal-style controls and panels, the existing theme preference and its dark default, along with the sidebar, tabs, form identifiers and demo behavior. Its hover actions use the preserved portal hover tokens. Customer subscription and referral surfaces remain consistent with that identity.

The Lumen pompom button exposes `aria-pressed`, Enter/Space activation and visible focus. Pulling downward beyond the existing bounded threshold and releasing toggles the illustrative page light. Short/upward pulls and cancellation leave the light unchanged. Pointer capture supports mouse and touch. This gesture does not control the visitor's display. Reduced motion removes image/button transitions and smooth scrolling.

Driftora's purchase plans remain keyboard-operable radio buttons. Theme background changes are immediate to preserve text contrast. Purchase hover colors and free-feature markers retain the existing `home.css`/subscription palette; the portfolio palette does not replace them.

## Do's and Don'ts

### Do:
- **Do** keep portfolio paper, ink, quiet text, dividers and specimen stage coherent in both appearances.
- **Do** use local Golos Text for the portfolio, including its compact Family Pie wordmark.
- **Do** keep actual application screens, their source labels, adjacent explanations and full-image links readable.
- **Do** retain Work and Contact in the mobile header's second row.
- **Do** preserve shared language/theme preferences, visible keyboard focus and usable static links.
- **Do** preserve VPN, Lumen product and Driftora purchase rules within their existing customer surfaces.

### Don't:
- **Don't** carry the old homepage portal canvas, decorative red edge lighting or catalog accordion into the replacement portfolio.
- **Don't** turn the customer's portal or lamp palette into portfolio tokens.
- **Don't** invent application screens, testimonials, performance numbers or customer evidence.
- **Don't** present personal motivations as achieved weight loss or clinical benefit.
- **Don't** describe existing Android/macOS image assets as fresh device or cross-platform acceptance.
- **Don't** let the portfolio replacement remove direct product, download, legal or purchase routes.

### Maker-story paragraph

The homepage introduction includes the owner’s pie-sharing image after his role statement. `.intro .family-note` uses Golos Text at16px,1.65 line height, a66ch maximum measure and24px top spacing, with the existing quiet text color in both themes. This is a local supporting paragraph; it does not introduce another panel, display style or illustration. Selected-work copy and case introductions use his confirmed app motivation and current use.


## Reference-led showcase layout preview

`/preview/showcase/` is a separate review variant requested after the owner supplied dev.cmde.ru. It extends the existing neutral Golos/coral world rather than replacing the current homepage or work pages. A compact name/role/action group sits beside a real owner portrait; the confirmed pie-sharing story follows in a full-width row. Two image-first project cards show existing Android/macOS evidence before purpose, case links and stack. The topology becomes a single column below700px; the header keeps its mobile Work/Contact row.

The local type steps above reflect this denser composition: display54px maximum (40px intermediate,36px narrow), summary20/18px, project/story/action16px, heading30px, stack/full-image label13px. Panel/control corners use existing6px, Android specimen existing14px. Repeated project cards represent two equivalent work destinations; no new capability claims, badges, testimonial or results are introduced. Existing controls, stored appearance/language preferences and the arrow hover remain shared. The owner supplied a real portrait, displayed through CSS square framing with object-position62%45%. Its original JPEG pixels remain unchanged. On mobile the name/role/actions precede a centered280px portrait and single-column brand story. The image is a local-only ignored asset, protected with the private recovery evidence; publishing it still requires approval of the shown result.

These type steps intentionally belong only to the review route. They address hook-reported type-ramp gaps; no detector suppression is added. The pre-existing sidecar freshness warning is outside this scoped layout change and is not autonomously repaired. This variant is not owner approval to publish or to replace the main homepage.
