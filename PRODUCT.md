# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
Family Pie is Evgeny Tikhonenko's website. Its homepage addresses employers considering a full-stack developer. Driftora and Lumen + REST are the selected work: each has a case page explaining its purpose and implementation, with existing application screens. The developer's name, role and contact are visible. His full-stack scope includes websites, mobile and desktop applications, and backend services.

The site's separate product, download, legal and purchase routes serve application users. Removing a project from the employer-facing selection does not remove its service or direct routes.

## Capabilities and Constraints
Static HTML/CSS/JavaScript, released through the repository's existing GitHub CI/CD. `/`, `/work/driftora/` and `/work/lumen-rest/` use scoped portfolio styles. Customer-facing pages retain their own styles and APIs. The complete product catalog remains in `data/products.json` for legal generation; the homepage does not duplicate that catalog.

RU/EN uses the existing `fp_lang` preference and shared language API. Portfolio theme selection shares `family-vpn-theme-v3` with the existing site, with complete light and dark styles and a system-based initial choice. Copy and links remain usable without JavaScript. Payment, authentication and native application behavior are outside this portfolio change.

## Brand Commitments
Keep the Family Pie site name connected to the visible developer. The owner’s pie image provides that connection: he brings a pie, and people take a bite by using his applications. Present actual work and concrete explanations; do not substitute an abstract portal, invented app screens, interchangeable benefit slogans, testimonials or performance numbers. Do not infer achieved weight loss or clinical benefit from personal intent. Sufler, Family VPN and unfinished ReloDojo are excluded from the homepage's employer-facing work selection.

## Evidence on Hand
The owner confirms sole authorship of Driftora, including its backend and calculations. He now uses it daily to log food, and also records workouts and walking. His need for calorie tracking with spoken food input, and not finding a suitable application he trusted, explain why he started it. Its photo→draft→review→local-save path, nutrition-source attribution and calculations were inspected in the application source; 66 focused existing tests passed during the case-content step. The Android screen is an existing store asset showing text input, labelled accordingly; it is not fresh camera-flow acceptance.

Lumen + REST's native Mac timer/display integration and separate Python/PySide6 Windows/Linux implementation were inspected. The owner has installed it on his desktop computer for work breaks and eye rest, with display controls for a warmer screen. Existing macOS settings and reminder images illustrate these flows. Do not turn the screenshots into new physical-device or cross-platform acceptance claims. The application page retains platform/release limitations.

## Current layout study

The owner supplied dev.cmde.ru as a reference for a more compact personal portfolio with image-first projects. `/preview/showcase/` is a separate RU/EN comparison variant with an owner-selected fixed black page background using the existing verified facts and assets. It does not replace the homepage or alter customer routes. The owner supplied a real portrait and then requested a dark-room lighting treatment. The local review uses an imagegen lighting edit of that photo; the untouched original remains preserved. Both image versions stay outside public Git pending approval of the shown result. Publication of any shown variant requires explicit owner approval.
