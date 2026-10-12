# Family Spy storefront

This is a second public surface of the existing Family Pie project. It reuses
the product sources and service origins; no new account or billing service is
created. The portfolio source in `site/` remains independent.

## Build and preview

```sh
node tools/build-customer-site.mjs
node --test tools/test-customer-site.mjs
node tools/serve-customer-site.mjs 8133
```

The generated `customer-site/dist/` directory is ignored. Edit the four customer
source files or the builder, never generated copies. The builder accepts only
managed output directories inside this repository.

Public routes are `/`, `/vpn/`, `/sufler/`, `/sufler/setup/` and each product's
terms/privacy pages. Unknown routes return 404 rather than the portfolio.
The two public plan endpoints are a fixed read-only allowlist.

`/vpn/cabinet`, `/vpn/admin` and `/sufler/buy` and their descendants temporarily
redirect to `https://family-pie.ru` with the same path/query. Browser fragments
also survive this redirect. This keeps authentication, passkeys, active payment
recovery and native links on their established origin. New-domain authentication
and billing migration are outside this release.

## Publication route

The owner's actual-render approval gate in `AGENTS.md` applies. A draft branch or
passing PR check does not authorize publication.

After approval, provision the separate `/var/www/family-products/site` root for
the existing CI deploy user. The existing `deploy.yml` builds both artifacts,
stamps their exact integrated SHA in `release.json`, rsyncs each to its own root,
and applies the reviewed Caddyfile through the existing validated wrapper.

On the current shared edge, nginx streams TLS by SNI before Caddy. Back up its
configuration and verify it has not changed since preflight. Add only
`family-spy.ru` and `www.family-spy.ru` to the existing Caddy SNI map, validate
before reload, and preserve every VPN route. DNS apex/www A records then point
to the same established web server. Keep Reg.ru nameservers and unrelated
records. Read the current VPN operational prohibitions before any edge edit.

Verify CI and both public/on-disk release revisions separately. Check customer
routes, strict 404s, price endpoints and canonical-flow redirects over HTTPS;
also check existing portfolio, hub and VPN service health. An old page answering
200 is not proof that a release is current. This is storefront verification,
not a paid purchase or actual VPN traffic test.

## Recovery

Revert the scoped commit through the normal main/CI route to restore the previous
Family Pie Caddyfile and site. The deploy wrapper retains timestamped validated
backups and rolls back its own configuration failure. Keep the pre-edit nginx
backup separately; restoring that file and validated reload restores its exact
SNI state. Registrar A-record history must retain the pre-edit parking values.
Neither storefront deployment nor rollback copies, clears or migrates service
databases, customer secrets or sessions.
