#!/usr/bin/env bash
# fp-deploy-caddy — install a CI-staged Caddyfile into /etc/caddy and apply it.
# =============================================================================
# Runs as root via ONE scoped NOPASSWD sudoers entry for the unprivileged
# `deploy` user (the same user the GitHub Actions deploy uses). Security model:
#   - This script is root-owned, 0755, NOT writable by `deploy`, so the deploy
#     user cannot change WHAT runs as root — only the *content* of the staged
#     Caddyfile (which is exactly the artifact being deployed).
#   - The staged config is `caddy validate`-d BEFORE the live one is touched, and
#     the script auto-rolls-back if the reload fails — so a broken Caddyfile in
#     a commit can never take the live site (or food.family-pie.ru) down.
# One-time setup that enables this: see tools/vps/README.md.
# =============================================================================
set -euo pipefail

STAGED=/var/www/family-pie/caddy-staging/Caddyfile
LIVE=/etc/caddy/Caddyfile
BACKUP_DIR=/etc/caddy/backups

log() { echo "fp-deploy-caddy: $*"; }

[ -f "$STAGED" ] || { log "no staged Caddyfile at $STAGED — nothing to do" >&2; exit 1; }

# 1. Validate the staged config first; refuse to proceed if it is invalid.
caddy validate --config "$STAGED" --adapter caddyfile

# 2. Skip the reload if nothing actually changed (idempotent, avoids churn).
if [ -f "$LIVE" ] && cmp -s "$STAGED" "$LIVE"; then
	log "live Caddyfile already matches the staged one — no change"
	exit 0
fi

# 3. Back up the current live config, timestamped.
mkdir -p "$BACKUP_DIR"
ts=$(date -u +%Y%m%dT%H%M%SZ)
backup=""
if [ -f "$LIVE" ]; then
	backup="$BACKUP_DIR/Caddyfile.$ts"
	cp -p "$LIVE" "$backup"
fi

# 4. Apply the new config, rolling back to the backup if it will not come up.
#
# RELOAD IS NOT ALWAYS AVAILABLE. `systemctl reload caddy` runs `caddy reload`,
# which talks to the admin API on :2019 — and this deployment sets `admin off`,
# so the reload fails with "connection refused" no matter how good the config is.
# A wrapper that only knew how to reload therefore failed EVERY deploy while the
# config it had just installed was perfectly valid.
#
# So: try reload (zero downtime, the good path), fall back to restart (a blip,
# but it is the only way with the admin API off). Rollback uses the same ladder.
apply() {
	systemctl reload caddy 2>/dev/null && { echo reloaded; return 0; }
	systemctl restart caddy && { echo restarted; return 0; }
	return 1
}

install -m 0644 "$STAGED" "$LIVE"
if ! how=$(apply); then
	log "apply FAILED" >&2
	if [ -n "$backup" ]; then
		log "rolling back to $backup" >&2
		cp -p "$backup" "$LIVE"
		apply >/dev/null || log "rollback also failed — caddy needs manual attention" >&2
	fi
	exit 1
fi

# `systemctl restart` returning 0 only means it started; a unit that dies a second
# later would otherwise be reported as a successful deploy.
sleep 2
if ! systemctl is-active --quiet caddy; then
	log "caddy is not active after $how" >&2
	if [ -n "$backup" ]; then
		log "rolling back to $backup" >&2
		cp -p "$backup" "$LIVE"
		apply >/dev/null || log "rollback also failed — caddy needs manual attention" >&2
	fi
	exit 1
fi

log "installed + $how${backup:+ (backup: $backup)}"
