# Family VPN preliminary interface

Public routes: `/vpn/`, `/vpn/cabinet/`, `/vpn/cabinet/auth/`.

Static HTML/CSS/JS extends the existing Family Pie site. No server configuration change is needed. All cabinet screens are public demonstrations. No login session, real subscription key, payment, referral credit or sent support ticket is created. Local storage holds theme, news visibility and an explicitly local support draft only.

The reference account was inspected with owner sign-in: home (no subscription), plans and promo, friends and QR, diagnostics, device FAQ, support, settings and news. No competitor source, private data or artwork was copied. Prices, bonus percentages and other commercial promises are deliberately undecided.

Before commercial launch: approve tariffs/device policy and legal texts; implement server-owned identity and sessions; link each account to its own VPN subscription; integrate approved merchant/test checkout and authenticated/idempotent fulfilment; implement renewal/expiry/refunds; connect support and referral accounting; separately validate VPN performance and user-device connections. Never expose panel credentials or personal subscription links in static assets.

Verification: JS syntax; existing legal build; local IDs/assets/links; real browser journeys for route navigation, platform selection, plan selection, unavailable promo, FAQ, QR, site-only latency probe, local draft save/reload, theme persistence and auth placeholder; desktop 1280px and mobile 390/320px. No horizontal page overflow in final checked views, no observed browser JS errors. Live payment/identity and physical VPN client tests were not performed.

Rollback: revert the scoped PR; standard Family Pie deploy removes this directory. Existing site routes and Caddyfile remain unchanged.
