# Owner TODO — fill the legal placeholders

The public legal pages (`site/<app>/{legal,terms,privacy}`) are **drafts**. Every
`[INSERT …]` / `[13 / 16 …]` / `[Operator: …]` below is a value only you can supply.
A draft/lawyer-review disclaimer stays on every page until these are filled **and** a
qualified lawyer has reviewed the text.

**Workflow:** the legal **canon** lives in the app repos
(`SpiritusMalus/HealthRoutine`, `SpiritusMalus/relo_dojo`). Fill the fields there (both
languages), re-mirror into `content/` here, then regenerate:

```
node tools/build-legal.mjs      # rebuilds site/<app>/*.html + sitemap.xml
```

Verify nothing is left:

```
grep -rn "INSERT" content/ site/      # should return 0 lines when complete
```

---

## Common to BOTH apps — every document (Terms + Privacy, RU + EN)

- [ ] **`[INSERT DATE]`** — effective date of the documents.
- [ ] **`[INSERT LEGAL NAME / SOLE PROPRIETOR]`** (EN) / **`[INSERT LEGAL NAME / ИП]`** (RU) — operator's legal name (in the header line).
- [ ] **`[INSERT LEGAL NAME]`** — operator's legal name again (in the final "Contact" line).
- [ ] **`[INSERT CONTACT EMAIL]`** — contact email (appears in the header, Contact, and consent/withdrawal sections).
- [ ] **`[13 / 16 — choose per your markets]`** / **`[13 / 16 — выбрать по рынкам]`** — pick the minimum age (13 or 16) for your markets; apply the same number in Terms §2 and the Privacy "Children" section.

## Terms of Use — both apps

- [ ] **`[INSERT JURISDICTION]`** — governing law (Terms, "Governing law & disputes").
- [ ] **`[INSERT VENUE]`** — court/venue for disputes (same section).
- [ ] Relo Dojo Terms §12 — **`[Operator: add any jurisdiction-specific liability cap …]`**: add a liability cap if your jurisdiction allows, or delete the note.
- [ ] Health Routine Terms §9 — **`[INSERT: any limitations specific to the jurisdiction.]`**: same decision for HealthRoutine.

## Relo Dojo — Privacy Policy

- [ ] **`[INSERT POSTAL ADDRESS IF REQUIRED BY YOUR STORE/MARKET]`** (EN) / **`[INSERT POSTAL ADDRESS, …]`** (RU) — postal address, if your store/market requires one.
- [ ] **`[Operator: confirm the RF hosting region/provider …, transfer mechanism]`** ("International transfers") — confirm the RF hosting region/provider and, if you serve EU/UK users, your transfer mechanism.

## Health Routine — Privacy Policy

- [ ] **`[INSERT]`** ("Where data is stored", sync paragraph) — the sync **host & jurisdiction** that must pass review before sync ships.
- [ ] **`[INSERT: chosen host / jurisdiction]`** ("Legal bases (152-FZ)") — the chosen sync host / jurisdiction.
- [ ] **`[INSERT: references to Roskomnadzor (RKN) notifications …]`** — the RKN notification references (processing Art. 22 + cross-border transfer).
- [ ] **`[INSERT: host]`** ("Transfer to third parties") — the sync host name.
- [ ] **`[INSERT: if applicable — the AI provider's retention terms / DPA.]`** ("Storage and deletion") — the AI provider's retention terms / DPA, if applicable.

---

## Beyond the brackets (not auto-detected — decide before publishing)

- [ ] **Translation review.** The RU↔EN second language of each document was produced by the executor (machine translation, structure + placeholders verified) and is **not certified**. Have a qualified bilingual lawyer review both languages.
- [ ] **Store/contact details** referenced on the landing (`support@family-pie.ru`) — confirm the address is real and monitored.

_Generated 2026-06-22 as part of TASK-2026-06-21-build-family-pie (step 7)._
