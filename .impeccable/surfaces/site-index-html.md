---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["route:/","route:/work/driftora","route:/work/lumen-rest","site/work/driftora/index.html","site/work/lumen-rest/index.html","site/portfolio.css","site/portfolio-theme.js","site/portfolio.js","site/work/assets/driftora-review.png","site/rest_lumen/assets/settings-macos.png","site/rest_lumen/assets/reminder-macos.png","site/vpn/fonts.css","site/i18n/language.js","route:/preview/showcase","site/portfolio-showcase.css","site/portfolio-showcase.js","site/portfolio-screens.js","site/preview/showcase/index.html","site/preview/showcase/layout.css","site/work/assets/eugene-portrait.png","site/work/assets/driftora-review-ru.png","site/work/assets/driftora-review-en.png","site/work/assets/lumen-settings-ru.jpg","site/work/assets/lumen-settings-en.jpg"]
---

# Family Pie developer portfolio and work pages

## Scope and visitor mode

**Experience** at `/`: an employer quickly understands what Eugene Tihonenko builds, jumps to two real projects, inspects their application evidence and reaches his contact destinations. The two `/work/` case pages support **Read** within the existing portfolio world. Author voice stays first-person singular in RU/EN; the public English name is exactly Eugene Tihonenko.

Customer-facing VPN, Lumen product, purchase, download and legal routes keep their own content, styles and behavior. The employer-facing selection remains Driftora and Lumen + REST; `data/products.json` remains the complete legal/product catalog.

## Direction and memorable moment

The owner explicitly chose the dev.cmde.ru pattern: prominent immediate access to projects, a compact introduction to the maker, colorful previews and softer boundaries. This refines the incumbent Golos/coral identity. The first body comment in `site/index.html` and its comparison page is the direction contract.

The root and `/preview/showcase/` use soft charcoal, coral, subdued rounded frames and green/amber capture stages. `site/portfolio-showcase.css` specializes shared `portfolio.css`; the comparison route imports the same CSS through `preview/showcase/layout.css`. The root stays fixed dark without changing the saved shared appearance preference. Case pages keep their existing light/dark palette, grid and content.

The first viewport presents a short service headline, a bright My projects anchor to `#work`, a secondary contact action and the existing capability list. A compact native About disclosure follows with the actual portrait, name and the owner's career path and work preferences. Desktop starts open; JavaScript initially collapses it at 760px or below, and no-JavaScript content stays open/readable. Language changes preserve the visitor's open/closed choice. The real portrait remains `site/work/assets/eugene-portrait.png`.

Two equal project cards follow. Each leads with project name and purpose → actual capture → source caption and independent screenshot-language controls → short personal explanation, case action and stack. Driftora's homepage crop focuses meal review, editable portion and nutrition-source detail. Lumen's upper settings crop shows lamp and timer controls. Two cards become one column at 760px; there is no invented third item. Contact closes the page with existing email, LinkedIn and one GitHub destination.

## Content and actions

- Work and Contact navigate to the homepage sections; each project links to its real case page, `/work/driftora/` or `/work/lumen-rest/`.
- The actual matching RU/EN Android image is an unsaved 100 g meal draft. The actual matching macOS image shows Lumen settings. Neither adds camera/speech-flow, physical-device or cross-platform acceptance claims.
- Screenshots remain inline on the selected portfolio surfaces. No image anchor, full-screenshot CTA, separate viewer, modal or new tab remains. Case pages preserve full uncropped inline captures.
- Screenshot-language choice is independent of page language, cached across Back navigation, and retains existing load/failure recovery through `portfolio-screens.js`.
- Case pages preserve their narrative/media composition and inspected implementation explanations. Footers retain cross-project and customer destinations, including `/driftora/legal` and `/rest_lumen/`.
- No new product, client claim, price, experience metric, capability or outcome is introduced. Personal motivations do not establish achieved weight loss or clinical benefit.

## Behavior and constraints

The compact hero, author disclosure and project-card composition are homepage-specific. The scoped container is 1100px maximum, card gap 24px and principal panel radius 16px. Gutters adapt at 900px, 760px and 420px. The shared mobile Work/Contact navigation row remains visible; keyboard focus and the skip link remain usable. The project CTA is a real anchor. The only added motion is its small arrow response when reduced motion is not requested.

Portfolio routes keep English static/first-visit copy; explicit URL and saved Russian choices remain authoritative through `fp_lang`, `/i18n/language.js` and native `data-ru` / `data-en` rendering. Visible and accessible names remain synchronized. Case-page appearance continues through `portfolio-theme.js` and `family-vpn-theme-v3`; customer styles and preferences stay separate. No-JavaScript copy, images, About content and destinations remain readable.

## Verification and unresolved decisions

**State: PREVIEW — not approved for publication and not asserted live.** This current 2026-10-19 refinement supersedes the homepage composition described in the 2026-10-11 approved black-showcase record. The historical approval does not approve this cumulative preview. Publication still requires approval of the latest shown result and green CI through the established route.

An independent finish review found no material visual issues and readiness for preview. Exact visual, functional and preservation evidence is recorded in the existing project journal. This documentation describes the built preview and does not establish device or deployment acceptance.
