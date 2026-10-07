---
version: 1
slug: "site-rest-lumen-index-html"
primary_target: "site/rest_lumen/index.html"
related_targets: ["route:/rest_lumen/", "site/rest_lumen/style.css", "site/rest_lumen/lamp.js", "site/rest_lumen/assets/lamp-room.jpg", "site/rest_lumen/assets/settings-macos.png", "site/rest_lumen/assets/reminder-macos.png", "site/i18n/en.js", "site/i18n/language.js", "site/vpn/fonts.css"]
---

# Lumen + REST product landing

## Scope and visitor mode

The bilingual RU/EN product page at `/rest_lumen/` helps visitors understand screen comfort and break reminders, inspect the actual application, and choose a release for their OS. This brief covers only this product surface; the studio homepage and VPN retain their existing design rules.

## Direction and memorable moment

Inherit local Golos Text, the compact Unbounded studio wordmark, 3px control corners and 6px panel corners. Use the implemented dark background `#0d1014`, warm light text and warm accent `#f1c27d`. The owner pinned the AI-generated photographic fabric lamp after rejecting a flat render. `assets/lamp-room.jpg` presents the cream fabric shade and pompon in a dark room with physical illumination and shadows; its masked edges blend into the surrounding background.

Desktop pairs the product headline and download action with the lamp. Mobile stacks the same reading order. The recognizable moment is clicking the lamp to dim or restore its pictured light. Preserve the actual macOS settings and reminder screenshots below the hero as product evidence.

## Content and actions

- The main download action reaches `#download`. Keep the six existing package links: macOS Apple Silicon ZIP and Intel DMG, Windows installer and ZIP, Linux DEB and archive. Preserve their versions and platform limitations.
- The lamp is a native button with a descriptive accessible label, visible focus and `aria-pressed`; mouse, touch and keyboard activation toggle `body[data-lamp]` between `on` and `off`.
- This interaction illustrates light on the page only. Do not describe it as system-wide display control or imply that the visitor's installed app state changes.
- RU/EN content, image descriptions and the lamp label use the shared language preference `fp_lang` and reviewed keys in `/i18n/en.js`. Preserve navigation to the studio and shared language controls.

## Behavior and constraints

Keep responsive stacking, readable platform rows, skip navigation and visible keyboard focus. Reduced-motion preference disables image/button transitions, active-button displacement and smooth scrolling. The lamp uses a static photographic source and a filter for its off state; no continuous animation is required.

Preserve honest beta copy, installation constraints and distinctions between macOS Apple Silicon, Intel, Windows and Linux. Page artwork is illustrative; screenshots show the real application. These visual edits do not establish additional OS integration or release validation.

## Verification and unresolved decisions

Source basis: `index.html`, `style.css` and `lamp.js`, inspected on 2026-10-07. Acceptance checks: photographic lamp loads and blends into the dark ground; on/off and pressed state agree; keyboard activation and focus work; RU/EN labels remain complete; reduced motion removes transitions; mobile remains readable; real screenshots and all six release links remain unchanged. These criteria do not claim completed browser or deployment verification.

No visual direction remains open: the owner selected the photographic lamp. Application release verification remains governed by the Lumen + REST project separately.
