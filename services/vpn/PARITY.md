# Full functional scope requested by owner

The owner explicitly requests the entire functional cabinet flow of chashkakofe.app, retaining the approved Family VPN dark/red portal style. Do not reduce this to a visual clone or treat the foundation below as feature completion.

| Reference area | Required real behaviour | Current status |
|---|---|---|
| Identity | Verified email entry, Google OAuth, passkey registration/login/removal, logout and owned sessions | Password login/session/forced initial change implemented; Google/passkey/email verification pending |
| Subscription | Actual owned status/expiry, personal key/link/QR, import into supported clients | Owned profile and admin add/edit/soft-delete bridge implemented; live acceptance tracked in task journal |
| Tariffs and orders |30/90/180/365 days, approved prices/device policy, coupon validation, payment history | Public demo; immutable order snapshots/idempotency prepared; tariff/merchant answers required |
| Payment lifecycle | Test-store and live confirmation, cancel/failure/retry, renewal, expiry, refund | Provider read-verification and transactional grants/full refunds tested locally; no actual checkout or live adapter |
| Device onboarding | Account-specific link/QR, Android/iOS/Windows/macOS/Linux/TV guides, actual working profile | Public guides work; personal issuance/import verification pending |
| Invitations | Owned referral URL/QR, invite ledger, approved discounts/rewards/balance/payout | Public site-sharing only; terms and accounting implementation pending |
| Diagnostics | Real endpoint reachability, measured down/up/ping/jitter and truthful VPN detection | Site-only reachability probe; no VPN status or invented metrics |
| Support | Authenticated stored chat, attachments, admin replies, delivery and history | Local draft UI; scoped ticket storage prepared, no delivery/admin/attachment implementation |
| Settings | Profile, linked email/Google/Telegram, notifications, push permission/device, passkeys | Local theme/news preference only; account settings pending |
| News | Stored posts, read state, pagination, permissions | Static public example only |
| Operations | Provisioning reconciliation, leased retries, expiry enforcement, restore, health and rollback | Durable jobs prepared/tested; runtime worker and operational acceptance pending |

Reference inspected after owner login on an account without subscription. Paid checkout/provisioning, payout and active-account behaviour have not been observed; do not claim exact parity on unseen journeys. Revisit permitted screens and verify the completed owner journeys with an isolated account/test store.

Next delivery sequence: approved tariff/merchant and service isolation -> verified identity/session -> authenticated checkout -> safe account-specific provisioning/import -> renewal/expiry/refund/reconciliation -> referrals/support/settings/news/real diagnostics -> browser acceptance on desktop/mobile. Keep existing public demo labels until the corresponding function actually passes end-to-end verification.

Telegram reminders: native opt-in linking (session-bound nonce + same-session confirmation), private /status and /stop, durable polling offset/reminder outbox,3day/1day/expired cadence and renewal cancellation implemented. Existing unlimited subscriptions excluded. Dedicated BotFather token/name and real owner opt-in delivery acceptance required; no actual messages sent until that gate is met. This is not Google/passkey identity or a completed billing flow.


## Continuation — 2026-10-06 (supersedes foundation statuses above)

- Native registration/password sessions, forced legacy initial change, fresh-login protection for key/provider management and owned session revocation implemented. Passkey signatures/origin/RP/UV/challenge replay verified with generated cryptographic fixtures. Google PKCE/state/JWT and session-bound email verification are implemented; live OAuth/SMTP configuration remains absent.
- Authorized existing Sufler merchant API was verified. Gateway creates owned orders/receipts, checks redirects via authenticated provider reads, polls pending state and reconciles full refunds. Prices/devices are editable by admin; production defaults remain empty pending owner confirmation. No real purchase/refund acceptance yet. Imported24 unlimited accounts remain untouched.
- Owned link/QR and Happ import, device guides, durable history/profile, stored private support/messages/attachments/admin replies, news/publication/read state and invitation tracking implemented. Monetary referral policy is off until approved; snapshots, refunds, reservations and manually confirmed payouts are accounted for. Actual bank transfers/crypto are not automated.
- Real browser HTTP delay/jitter and small upload/download probes implemented with explicit limits. No fabricated VPN status; original client address unavailable means unknown, not disconnected. No separate physical-device identity tracking or guaranteed sustained tunnel benchmark.
- Existing Telegram bot is active and its real Start reply confirmed; actual cabinet binding/scheduled receipt remains pending. Opt-in web push and safe public-shell PWA implemented; real browser permission/reminder acceptance remains separate. No customer was subscribed or messaged automatically.
- Browser QA uses isolated synthetic identities and prices. Test-store/live customer transactions, provider configuration, hardware passkey enrollment, real notification delivery and any remaining reference behaviour not exposed on the inspected no-subscription account cannot be claimed complete from fixtures.
