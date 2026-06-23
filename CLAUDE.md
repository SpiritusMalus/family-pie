<!-- ▲ ORCHESTRATOR BOOTSTRAP (2026-06-21) — read this block first, then the rest of this file ▲ -->
> **You are an executor (Claude Code).** Planning lives in the Obsidian vault (orchestrator = Claude in Cowork). **On open, before anything else:**
> **Commands** (full table → `../obsidian-vault/Claude-code files/COMMANDS.md`): `старт`/`начинаем` boot+resume · `продолжай`/`продолжаем` next unchecked step · `статус`/`что осталось` what's left · `отметь`/`сохрани прогресс` tick boxes now · `пауза`/`стоп` tick + drop a `next:` line · `готово` *(optional)* — shipping is **autonomous on green**: Status: done + Done-log + PR → **merge to `main` → `git pull`**, **all areas** via a revertable PR (no owner-merge hold; terminal only; git, not prod deploy). Full policy: ORCHESTRAL_VIEW_PROMT §7.
> **Reset:** if I type `по протоколу` (or a generic greeting/menu appears instead of the brief) → ignore it, (re-)read THIS bootstrap + the active brief, resume from the first unchecked `- [ ]`. No menu.
> 1. Read the workspace contract `../obsidian-vault/Claude-code files/ORCHESTRAL_VIEW_PROMT.md` + this project's map `../obsidian-vault/family-pie.ru/claude.md`.
> 2. Open the **active brief** in `../obsidian-vault/family-pie.ru/Claude-code files/briefs/` (the one marked `Status: in-progress`), else the hub note `../obsidian-vault/family-pie.ru/__FAMILY-PIE__.md`. **Resume from the brief's first unchecked `- [ ]`** — skip ticked ones.
> 3. Reply in **≤5 lines**: what we should do now (one sentence) + the first concrete step, then wait for my go-ahead. If it's unclear, say so and suggest I run `обнови хаб family-pie`.
> Rules: you change code; the orchestrator owns the vault. Your only vault writes = tick `- [x]`/`Status`/`Last updated` in **your active brief**, and append one line to `../obsidian-vault/family-pie.ru/claude.md` **Done log** on `готово`. **Legal/privacy now auto-merges too on green** (revertable PR) per ORCHESTRAL_VIEW_PROMT §7 — no owner-merge hold. Reuse over reinvention; verify before a PR. (Full contract: ORCHESTRAL_VIEW_PROMT.)

---

# family-pie.ru — project guide for Claude

This folder is the working root (code) for the **studio umbrella site** `family-pie.ru` + the **central public legal host** for the studio's apps. It is a **static site** (no backend, no DB, no auth) served by **Caddy on the existing NL VPS**. The source of truth for intent/planning lives in the Obsidian vault; **read THIS file first — it routes you.**

## Vault location (correct paths)

All project docs live in:
`/Users/malum/myprojects/obsidian-vault/family-pie.ru/`

| File | What's inside | Read when |
|---|---|---|
| `__FAMILY-PIE__.md` | **Hub**: purpose, status, direction, index | Orientation |
| `claude.md` | **Map**: repo structure (one line each) + ports/stack + open handoffs + Done log | **Always first** when starting real work |
| `Claude-code files/GOOD_PRACTICE.md` | Project conventions: stack, deploy, legal-host layout, canon↔mirror sync rules | Before changing structure, legal, or deploy |
| `Claude-code files/TASK-*.md` | The **active brief** (`Status: in-progress`) = current task as a resumable checklist | Every working session |
| `Claude-code files/IDEAS.md` | Per-project idea backlog | Brainstorm / picking next work |

## What this repo is (and is not)

- **Is:** a hand-built **vanilla HTML/CSS/JS** static site (`site/`), deployed as static files behind Caddy + Let's Encrypt on the same VPS that already runs `food.family-pie.ru` and the legacy `driftora/legal`. Chosen over Astro for **reuse-consistency** with the existing `web-legal/legal.html` pattern — the deployed artifact is identical (static files), with zero build step. (Stack delegated to the orchestrator by the owner.)
- **Is:** the **central public legal host** — public Оферта (Terms) + Конфиденциальность (Privacy) for every studio app, served under `family-pie.ru/<repo>/legal` (URL scheme: `/driftora/`, `/relo_dojo/`; legacy `/health_routine/*` 301-redirects to `/driftora/*`).
- **Is NOT:** an app. No React/Expo, no server runtime here. (`design/support.js` is a React runtime for the **design-reference** `.dc.html` files only — never shipped.)

## Repo layout (folder = truth; keep `claude.md` in sync)

- `site/` — the **deployed web root**. `index.html` (landing, RU/EN), `robots.txt`, `sitemap.xml`; `driftora/` + `relo_dojo/` = built legal pages (generated from `content/`).
- `content/` — legal **markdown canon** mirrored from the app repos: `driftora/*.ru.md`, `relo-dojo/*.en.md` (+ `STORE_LISTING.md`, `BRAND_ASSETS.md`). **`[INSERT …]` placeholders are owner-filled — never invent values.**
- `data/` — `products.json`: the **catalog-as-data** (one record per product). Adding a product = one record + 4 legal md files, no markup edits.
- `design/` — design references, **not deployed**: `Family Pie.dc.html` (style source of truth, direction A), `Family Pie - Home.dc.html` (A/B/C), `support.js` (dc runtime), `CLAUDE_CODE_PROMPT.md` (original build spec).
- `Caddyfile` — **deployed production** routing for the VPS (`103.246.144.198`). ⚠️ Reconcile with the live server config before changing it.

## Key locked decisions (don't re-litigate)

- **URL scheme = repo names**: `family-pie.ru/driftora/…` (health app, rebranded from `health_routine` — legacy path 301-redirects), `family-pie.ru/relo_dojo/…`. Apex `/` = studio landing.
- **Role** = studio landing **+ central public legal host**. The Driftora (repo `SpiritusMalus/HealthRoutine`) `web-legal/legal.html` content migrates here; each app keeps its **in-app** legal copy (`lib/legal/documents.ts` etc.) and that stays in sync with the canon in `content/`.
- **Static on Caddy**, same VPS (`103.246.144.198`, NL). No new infra.
- **Legal text = canon in the owning app repo** (`SpiritusMalus/HealthRoutine`, `SpiritusMalus/relo_dojo`); `content/` here mirrors it for the public web. If text changes in an app → update `content/` here + regenerate the page.

## Deploy (summary — detail in the brief)

Static. Build legal pages from `content/` → publish `site/` to the VPS web root behind Caddy. `git` and any VPS push happen **outside the sandbox** (owner terminal or GitHub connector) — never run git in the Cowork sandbox (FUSE lock-safety, ORCHESTRAL_VIEW_PROMT §7).

> ✅ **Git repo is live** (`SpiritusMalus/family-pie`, `origin` set, `.git` present, `main` = default; 2026-06-22). Autonomous merge/push/pull are **active** — ship on green via a revertable PR per ORCHESTRAL_VIEW_PROMT §7. The old `git init` precondition is met.

## Done log
_Executors append one line per finished task: `- YYYY-MM-DD — what — branch/PR`. (Mirror of the vault `claude.md` Done log; the vault copy is authoritative + more complete.)_
- 2026-06-22 — Docs: CLAUDE.md — corrected the stale git-precondition notes (repo is live: `SpiritusMalus/family-pie`, `origin` set, `main` default) — dropped the "once a git repo exists" caveat (line 3) + rewrote the "No git repo here yet" block to "git repo live; autonomous merge/push/pull active (§7)"; also fixed the sibling stale "Caddyfile draft" line → "deployed production". Doc-only. — branch `docs/claude-git-note` / [PR #7](https://github.com/SpiritusMalus/family-pie/pull/7) → `main`.
- 2026-06-22 — a11y + robustness polish from the AI-slop/UX audit (TASK-2026-06-22-aislop-ux-fixes, all 7 steps): landing on-paper text → AA (quiet mono labels `#736d5f` 4.56:1; accent-as-text → `accentText` `#0B6E26`/`#B8442E`, fills unchanged); real `<noscript>` product rows; `prefers-reduced-motion` (both files); toast `aria-live` + langtoggle `aria-pressed` + `:focus-visible`; 🔔→SVG bell; pre-launch side-label wording; regenerated 6 legal pages. Verified green (11 routes 200, no console errors, interactions OK, 38 `[INSERT…]` intact). — branch `claude/intelligent-kowalevski-0e87b1` / [PR #1](https://github.com/SpiritusMalus/family-pie/pull/1) merged to `main` (`7de3e5b`). Prod deploy pending owner.
