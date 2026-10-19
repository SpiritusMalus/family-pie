# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
Family Pie is Eugene Tihonenko's website. Its homepage addresses employers considering a full-stack developer. Driftora and Lumen + REST are the selected work: each has a case page explaining its purpose and implementation, with existing application screens. The developer's name, role and contact are visible. His full-stack scope includes websites, mobile and desktop applications, and backend services.

The site's separate product, download, legal and purchase routes serve application users. Removing a project from the employer-facing selection does not remove its service or direct routes.

## Capabilities and Constraints
Static HTML/CSS/JavaScript, released through the repository's existing GitHub CI/CD. `/`, `/work/driftora/` and `/work/lumen-rest/` use scoped portfolio styles. Customer-facing pages retain their own styles and APIs. The complete product catalog remains in `data/products.json` for legal generation; the homepage does not duplicate that catalog.

RU/EN uses the existing `fp_lang` preference and shared language API. The owner-approved homepage uses a fixed black canvas without changing the shared theme preference. Case pages retain the existing light/dark control and `family-vpn-theme-v3` preference. Portfolio routes default to English on first visit; explicit URL and saved RU choices still win. Copy and links remain usable without JavaScript. Payment, authentication and native application behavior are outside this portfolio change.

## Brand Commitments
Keep the Family Pie site name connected to the visible developer. The owner’s pie image provides that connection: he brings a pie, and people take a bite by using his applications. Present actual work and concrete explanations; do not substitute an abstract portal, invented app screens, interchangeable benefit slogans, testimonials or performance numbers. Do not infer achieved weight loss or clinical benefit from personal intent. Sufler, Family VPN and unfinished ReloDojo are excluded from the homepage's employer-facing work selection.

## Evidence on Hand
The owner confirms sole authorship of Driftora, including its backend and calculations. He now uses it daily to log food, and also records workouts and walking. His need for calorie tracking with spoken food input, and not finding a suitable application he trusted, explain why he started it. Its photo→draft→review→local-save path, nutrition-source attribution and calculations were inspected in the application source; 66 focused existing tests passed during the case-content step. The displayed Android screenshot pair is a real matching RU/EN unsaved 100 g meal draft captured on the owner-authorized local emulator. It is not camera/speech-flow or physical-device acceptance.

Lumen + REST's native Mac timer/display integration and separate Python/PySide6 Windows/Linux implementation were inspected. The owner has installed it on his desktop computer for work breaks and eye rest, with display controls for a warmer screen. Matching native RU/EN macOS settings captures illustrate the display/timer controls. The unpaired reminder was omitted from the portfolio case; the product asset remains available. Do not turn the screenshots into new physical-device or cross-platform acceptance claims. The application page retains platform/release limitations.

## Approved homepage release

The owner supplied dev.cmde.ru as a reference and approved the shown black showcase for production on 2026-10-11 Pacific. The same composition now serves `/`: name/role/actions beside the selected portrait, a short Family Pie story row, two image-first work cards, then contact. `/preview/showcase/` retains the matching comparison page with noindex. The public portrait is `site/work/assets/eugene-portrait.png`, byte-identical to the approved evening-light edit. Original and rejected taller variants plus private review screenshots remain outside public Git.

Screenshot language buttons swap real matching RU/EN captures independently of the page language, synchronize full-image links, and preserve choices on Back navigation. The public display name is exactly Eugene Tihonenko. Customer/payment/legal routes and native apps remain separate from this static-site release.


Owner screenshot behavior, 2026-10-19 (latest direction): remove separate full-screenshot opening everywhere on Family Pie and Family Spy. Screenshots remain inline; remove enlargement links and image anchors. Keep portfolio RU/EN screenshot selection, cached choice and load/failure recovery without depending on an enlargement link. No modal, separate viewer route, screenshot CTA or new tab. This supersedes the earlier same-day tab/viewer request. The homepage Sufler download CTA and existing copy/prices/layout remain unchanged. Preview approval still applies before publication.
