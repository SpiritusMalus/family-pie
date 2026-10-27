# Family VPN bot review artifact

`index.html` is a self-contained, interactive review page with embedded local Golos
fonts, the prepared avatar and a sanitized transcript. It is outside both deployable
web roots. Opening it or switching sample states does not contact Telegram.

The transcript contains thirteen states captured from the real `TelegramStore.update`
→ `TelegramUI` → injected synthetic sender: guest, existing-account binding, terms,
sales unavailable, active subscription, devices, installation/import, manual URL,
reminders on/off, support and password recovery. Visible message text and button labels are exact handler
output. Callback capabilities, internal account IDs and one-time handoff/reset tokens are
excluded. All shown access and expiry values belong to a synthetic account; Stars
prices are deliberately absent because sales are disabled and no prices are approved.

The preview renders native inline controls in a neutral theme. Actual Telegram
clients control their own button appearance. Sample buttons navigate the captured
states; external install/import actions show their destination without opening it.
This is not a screenshot or acceptance result from Telegram or a physical device.

Files prepared for the owner's publication review:

- `avatar.svg`: the existing Family Spy circle/three-line mark, adapted to a square
  charcoal/coral avatar with space for Telegram's circular crop.
- `avatar.png`: deterministic 1024×1024 raster of that vector. Embedded PNG provenance
  identifies the original repository mark; it is not an AI-generated illustration.
- `metadata.json`: display name, short/full description and the real command list,
  captured through `configureBotMenu` with a local sender, including `/recover`.
  Its status is `prepared-not-applied`; no BotFather or bot metadata API was used.
- `transcript.json`: sanitized evidence and SHA-256 hashes of the handler sources.

Rebuild from the repository root after installing the existing service dependencies:

```sh
node tools/build-vpn-bot-preview.mjs
```

The generator uses in-memory SQLite, current approved website tariff data to seed a
synthetic paid entitlement, disabled Stars pricing, fake delivery and a non-routable
example profile. It never constructs `TelegramClient`, reads a live token, calls a
payment provider, starts a poller or contacts a VPN server. Raw synthetic sender
payloads stay mode0600 under `.context/recovery/preview/bot/` in the protected local
context and are not part of this artifact.

The visual extension retains the incumbent Family Spy mark, Golos Text and existing
black/coral identity. Shared `PRODUCT.md`, `DESIGN.md`, site styles and live bot
settings are unchanged by this preview. Real desktop/mobile rendering, owner visual
approval, physical app import and Telegram payment acceptance are separate checks.
