#!/usr/bin/env bash
# fp-deploy-caddy — install a CI-staged Caddyfile into /etc/caddy and reload Caddy.
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

# 4. Install + reload. If the reload fails, roll back to the backup and re-reload.
install -m 0644 "$STAGED" "$LIVE"
if ! systemctl reload caddy; then
	log "reload FAILED" >&2
	if [ -n "$backup" ]; then
		log "rolling back to $backup" >&2
		cp -p "$backup" "$LIVE"
		systemctl reload caddy || log "rollback reload also failed — caddy may need manual attention" >&2
	fi
	exit 1
fi

log "installed + reloaded${backup:+ (backup: $backup)}"
