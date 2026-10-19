# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
Family Pie is Eugene Tihonenko's website. Its primary audience is product teams considering a full-stack developer; its secondary audience is entrepreneurs seeking client development. The owner explicitly seeks a team role while considering client projects and developing personal apps in his free time. Driftora and Lumen + REST are the selected work: each has a case page explaining its purpose and implementation, with existing application screens. The developer's name, role and contact are visible. His full-stack scope includes websites, mobile and desktop applications, and backend services.

The site's separate product, download, legal and purchase routes serve application users. Removing a project from the employer-facing selection does not remove its service or direct routes.

## Capabilities and Constraints
Static HTML/CSS/JavaScript, released through the repository's existing GitHub CI/CD. `/`, `/work/driftora/` and `/work/lumen-rest/` use scoped portfolio styles. Customer-facing pages retain their own styles and APIs. The complete product catalog remains in `data/products.json` for legal generation; the homepage does not duplicate that catalog.

RU/EN uses the existing `fp_lang` preference and shared language API. The homepage uses a fixed dark canvas without changing the shared theme preference. Case pages retain the existing light/dark control and `family-vpn-theme-v3` preference. Portfolio routes default to English on first visit; explicit URL and saved RU choices still win. Copy and links remain usable without JavaScript. Payment, authentication and native application behavior are outside this portfolio change.

## Brand Commitments
Keep the Family Pie site name connected to the visible developer. The pie mark retains the Family Pie identity. The About section now uses the owner’s supplied career story and work preferences. Present actual work and concrete explanations; do not substitute an abstract portal, invented app screens, interchangeable benefit slogans, testimonials or performance numbers. Do not infer achieved weight loss or clinical benefit from personal intent. Sufler, Family VPN and unfinished ReloDojo are excluded from the homepage's employer-facing work selection.

## Evidence on Hand
The owner confirms sole authorship of Driftora, including its backend and calculations. He now uses it daily to log food, and also records workouts and walking. His need for calorie tracking with spoken food input, and not finding a suitable application he trusted, explain why he started it. Its photo→draft→review→local-save path, nutrition-source attribution and calculations were inspected in the application source; 66 focused existing tests passed during the case-content step. The displayed Android screenshot pair is a real matching RU/EN unsaved 100 g meal draft captured on the owner-authorized local emulator. It is not camera/speech-flow or physical-device acceptance.

Lumen + REST's native Mac timer/display integration and separate Python/PySide6 Windows/Linux implementation were inspected. The owner has installed it on his desktop computer for work breaks and eye rest, with display controls for a warmer screen. Matching native RU/EN macOS settings captures illustrate the display/timer controls. The unpaired reminder was omitted from the portfolio case; the product asset remains available. Do not turn the screenshots into new physical-device or cross-platform acceptance claims. The application page retains platform/release limitations.

## Approved homepage release

The owner supplied dev.cmde.ru as a reference and approved the shown black showcase for production on 2026-10-11 Pacific. The production composition approved on that date serves `/`: name/role/actions beside the selected portrait, a short Family Pie story row, two image-first work cards, then contact. The current branch prepares the reference-led refinement described below. `/preview/showcase/` retains the matching comparison page with noindex. The public portrait is `site/work/assets/eugene-portrait.png`, byte-identical to the approved evening-light edit. Original and rejected taller variants plus private review screenshots remain outside public Git.

Screenshot language buttons swap real matching RU/EN captures independently of the page language, preserve choices on Back navigation and recover from failed loads. Screenshots remain inline, with no full-image link. The public display name is exactly Eugene Tihonenko. Customer/payment/legal routes and native apps remain separate from this static-site release.


Owner screenshot behavior, 2026-10-19 (latest direction): remove separate full-screenshot opening everywhere on Family Pie and Family Spy. Screenshots remain inline; remove enlargement links and image anchors. Keep portfolio RU/EN screenshot selection, cached choice and load/failure recovery without depending on an enlargement link. No modal, separate viewer route, screenshot CTA or new tab. This supersedes the earlier same-day tab/viewer request. The homepage Sufler download CTA and existing copy/prices/layout remain unchanged. Preview approval still applies before publication.


## Prepared reference-led refinement —2026-10-19

After comparing the live homepage with dev.cmde.ru, the owner explicitly chose the reference pattern (“Давай как у чела”): prominent immediate access to projects, compact author information nearby, colorful previews and softer boundaries. The incumbent Family Pie warm coral/Golos identity remains; this is a reference-led refinement, not another developer’s brand or content.

Homepage and showcase preview use a short service-first headline, project-scroll CTA and scoped capability list, then a compact native About disclosure and two real project cards. The disclosure is expanded on desktop and starts collapsed at760px or below with JavaScript; without JavaScript its content remains open/readable. Language changes preserve a user-opened/closed disclosure. Name, actual portrait and the owner-supplied career story and work preferences live together in that block. Cards lead with project name/purpose before real image preview, screenshot-language selection and case action. The Driftora crop focuses its meal review/source/portion; Lumen shows upper settings, lamp and timer. Full uncropped captures remain on existing case pages, inline only. Existing case content/themes, customer product pages and native/backend flows remain separate.

The homepage copy may be shorter while the full existing case explanations remain available. No new product, client claim, price, experience metric or capability is invented. Public display name remains Eugene Tihonenko; English default and explicit/saved Russian choices remain unchanged. The actual two-project selection is retained, with no invented third grid item.

This new preview is not yet approved for publication. PR108 also includes the already requested inline-only screenshot behavior on both sites. All changes require approval of the latest shown cumulative preview plus green CI before main integration/publication. Other held PRs remain independent.

## Portfolio copy

Use plain, concrete descriptions in RU and EN: name the application, its purpose and the actions it supports. Driftora recognizes food in photos, calculates calories and macros, supports portion review, and records workouts and walking. Lumen + REST provides break reminders and screen brightness/color controls, with platform details retained on its case page. Keep personal motivation and implementation detail on the case pages rather than repeating a generic development-services introduction. Biography copy must use owner-supplied facts; never infer a career history, clients or experience from the reference author.

## Owner biography evidence, 2026-10-19

The owner started with a website intended to help his father find new clients, then took programming courses and found his first development job. That job gave him experience from development to production and production support. He wants his main work to be in a team, is also interested in client projects, and develops personal products in his free time. He values reliable software, responsiveness, mutual understanding and teamwork. Driftora grew from his wish to lose weight and track his body when existing applications did not meet his needs. Lumen + REST embodies his wish to get up and stretch during computer work. These are personal motivations, not measured health outcomes. No dates, degrees, employers, years of experience or client-result claims are inferred.
