# VPS automation — Caddyfile auto-deploy

The GitHub Actions deploy (`.github/workflows/deploy.yml`) rsyncs `site/` to the
web root **and** ships the repo `Caddyfile` to `/etc/caddy/Caddyfile` + reloads
Caddy — so a change to routing now goes live on push to `main`, with no manual
SSH step. Prod always equals `main`.

To keep least-privilege, CI does **not** get blanket root. It can only run one
root-owned, validated, self-rolling-back wrapper ([`fp-deploy-caddy.sh`](fp-deploy-caddy.sh))
via a single scoped `sudo` entry. The deploy user can influence the *content* of
the Caddyfile (the artifact under review in git), never what runs as root.

## One-time setup (run once, as root on the VPS)

Needed only the first time — it grants the existing `deploy` user permission to
run the wrapper. After this, every Caddyfile change deploys automatically.

```bash
# 1. Staging dir the CI rsync writes the candidate Caddyfile into (deploy-owned).
install -d -o deploy -g deploy /var/www/family-pie/caddy-staging
mkdir -p /etc/caddy/backups

# 2. Install the root-owned deploy wrapper from the repo (locked down).
curl -fsSL https://raw.githubusercontent.com/SpiritusMalus/family-pie/main/tools/vps/fp-deploy-caddy.sh \
  -o /usr/local/bin/fp-deploy-caddy
chown root:root /usr/local/bin/fp-deploy-caddy
chmod 0755 /usr/local/bin/fp-deploy-caddy   # root-writable only — deploy cannot edit it

# 3. Allow `deploy` to run ONLY that wrapper as root, no password.
echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/fp-deploy-caddy' > /etc/sudoers.d/fp-deploy-caddy
chmod 0440 /etc/sudoers.d/fp-deploy-caddy
visudo -cf /etc/sudoers.d/fp-deploy-caddy   # must print: parsed OK

# 4. Heal prod now + prove it: trigger the workflow (or just push to main).
#    GitHub → Actions → "Deploy site to VPS" → Run workflow.
```

> If `DEPLOY_USER` (GitHub secret) is not `deploy`, use that username in steps 1 & 3.

## How a deploy runs after setup

1. CI rebuilds legal pages and rsyncs `site/` to the web root (exact mirror).
2. CI rsyncs the repo `Caddyfile` to `/var/www/family-pie/caddy-staging/`.
3. CI runs `sudo /usr/local/bin/fp-deploy-caddy`, which:
   - `caddy validate`s the staged config,
   - no-ops if it already matches live,
   - else backs up the live config to `/etc/caddy/backups/`, installs it, and
     applies it: `reload` first, `restart` if reload is unavailable — then checks
     the unit is still active two seconds later, rolling back automatically if
     any of that fails.

> **Why the restart fallback exists.** This box runs with `admin off`, and
> `systemctl reload caddy` works by talking to the admin API on `:2019`. With the
> API off, reload fails with "connection refused" however good the config is — so
> a reload-only wrapper failed every deploy while the config it had just installed
> was perfectly valid. A failed reload is harmless in itself (Caddy keeps serving
> the old config), which is exactly why it went unnoticed.
4. CI smoke-checks live routes (driftora 200, `/health_routine/*` → 301, apex
   aliases 200, food proxy 200).

## What is still manual

The CI key itself. `deploy` must have the workflow's public key in
`/home/deploy/.ssh/authorized_keys`, and the matching private key must live in the
`DEPLOY_SSH_KEY` secret. After the 2026-08 VPS move neither was carried over, and
`DEPLOY_HOST` still pointed at the retired box — which is why the deploy failed
with a connection TIMEOUT rather than a permission error. Anything that touches
key material is the owner's to do.

## Rollback

Each deploy timestamps a backup in `/etc/caddy/backups/`. To revert routing:
`cp /etc/caddy/backups/Caddyfile.<ts> /etc/caddy/Caddyfile && systemctl restart caddy`
— or just revert the commit on `main` and let CI redeploy.
