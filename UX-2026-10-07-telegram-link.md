# Simplified Telegram linking

Owner requested easier linking as part of login or purchase. Reuse existing session-bound ten-minute challenge, private bot Start and explicit cabinet ownership confirmation. No customer/session/payment/bot backend semantics change.

Overview after login and confirmed purchase offers optional Connect Telegram. One click creates the challenge and opens the bot; focus/visibility and bounded polling find the candidate without a manual check. Confirmation names the candidate; connected users are not prompted. Settings retain disconnect/reconnect. Blocked popups expose a safe fallback link; expired links and failures allow retry. Raw VPN profile links stay inside the authenticated cabinet.

26 frontend checks (seven linking scenarios) and78 backend checks pass. Synthetic real-entry browser acceptance and production delivery recorded in VPN/SESSION.md. Human Telegram Start on a real account remains separate acceptance; no unsolicited production messages or QA consumption of bot updates.

Recovery: named remote branch codex/vpn-telegram-simple, checkout /Users/malum/myprojects/family-pie-worktrees/vpn-telegram-simple; private synthetic preview/QA under VPN/.context/recovery/vpn-telegram-simple. Static-only rollback via scoped PR revert and existing CI; no live DB restoration.
