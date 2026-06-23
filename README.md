# family-pie.ru

Static umbrella site for **family-pie** — a small independent app studio — and the **central public legal host** for the studio's apps. No backend, no database, no auth: plain HTML/CSS/JS served as static files behind Caddy + Let's Encrypt on the studio VPS.

## Structure

```
site/                 deployed web root (Caddy serves this)
  index.html          landing — RU/EN, self-contained (no external JS)
  robots.txt
  sitemap.xml
  driftora/           built legal pages (Оферта/Конфиденциальность) — generated from content/
  relo_dojo/          built legal pages — generated from content/
content/              legal markdown canon (mirrors the app repos)
  driftora/           PRIVACY_POLICY.ru.md, TERMS_OF_USE.ru.md
  relo-dojo/          PRIVACY_POLICY.en.md, TERMS_OF_USE.en.md, STORE_LISTING.md, BRAND_ASSETS.md
data/products.json    catalog-as-data — one record per product
design/               design references (NOT deployed): .dc.html + dc runtime + build spec
Caddyfile             production routing (VPS 103.246.144.198) — auto-deployed to /etc/caddy by CI
tools/vps/            CI Caddyfile-deploy wrapper + one-time VPS setup (see tools/vps/README.md)
```

## URLs

- `https://family-pie.ru/` — studio landing
- `https://family-pie.ru/driftora/legal` (`/privacy`, `/terms`) — Driftora legal _(old `/health_routine/*` 301-redirects here)_
- `https://family-pie.ru/relo_dojo/legal` (`/privacy`, `/terms`) — Relo Dojo legal
- `https://food.family-pie.ru/` — Driftora Gemini food proxy (separate service, same VPS)

## Adding a product

1. Add one record to `data/products.json` (id, name, tag, descriptions RU/EN, accent colour, icon SVG, store links + status, paths to its 4 legal files).
2. Drop the 4 legal markdown files into `content/<product>/`.

No markup edits — the landing and legal pages render from the data.

## Deploy

Static, and live in production: Caddy serves `site/` over TLS on the VPS (`103.246.144.198`, NL) per the `Caddyfile` above.

**Deployment is automated (CI/CD).** Every push to `main` that touches `site/`, `content/`, `data/`, the legal builder, **or the `Caddyfile`** triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it rebuilds the legal pages from `content/`, `rsync`s `site/` to the VPS web root, ships the `Caddyfile` to `/etc/caddy` + reloads Caddy, then smoke-checks the live routes. **Prod always equals `main`** — no manual step, no laptop dependency. You can also run it on demand via the Actions tab (**Run workflow**).

Mechanics: the workflow authenticates as an unprivileged `deploy` user that owns `/var/www/family-pie/site`; the SSH private key + host live in GitHub repo **Secrets** (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_TARGET`) — never in the repo or on a laptop. The site rsync is an exact mirror (`--delete`) scoped to the web root, so the food proxy (`/opt`) is untouched. The `Caddyfile` is installed by a **root-owned, validated, self-rolling-back wrapper** the deploy user may run via one scoped `sudo` entry ([`tools/vps/fp-deploy-caddy.sh`](tools/vps/fp-deploy-caddy.sh)) — CI never gets blanket root, and a broken config auto-reverts. **One-time enablement** of the Caddyfile path: [`tools/vps/README.md`](tools/vps/README.md). Rolling back = revert the commit on `main` (the next deploy mirrors it), or restore a backup from `/etc/caddy/backups/`.

## ⚠️ Owner TODO before publishing (legal placeholders)

The legal markdown contains `[INSERT …]` placeholders that **only the owner can fill** — do not invent them:

- `[INSERT LEGAL NAME / ИП]` — operator legal entity / sole proprietor
- `[INSERT CONTACT EMAIL]` — contact email (proposed: `support@family-pie.ru`)
- `[INSERT DATE]` — effective date
- `[INSERT JURISDICTION]` / `[INSERT VENUE]` — governing law + venue
- `[INSERT POSTAL ADDRESS …]` — postal address, if a store requires it
- Relo Dojo: age threshold `[13 / 16]` — pick per target markets

The legal texts are **drafts pending lawyer review** — each page keeps its disclaimer; do not present them as certified.

> Planning, briefs and decisions live in the Obsidian vault: `../obsidian-vault/family-pie.ru/`. Claude Code: read `CLAUDE.md` first.
