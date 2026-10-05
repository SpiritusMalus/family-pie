# Full functional scope requested by owner

The owner explicitly requests the entire functional cabinet flow of chashkakofe.app, retaining the approved Family VPN dark/red portal style. Do not reduce this to a visual clone or treat the foundation below as feature completion.

| Reference area | Required real behaviour | Current status |
|---|---|---|
| Identity | Verified email entry, Google OAuth, passkey registration/login/removal, logout and owned sessions | Public UI only; internal account records are not login |
| Subscription | Actual owned status/expiry, personal key/link/QR, import into supported clients | Public demo; grant/expiry calculation and durable provisioning queue prepared |
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
