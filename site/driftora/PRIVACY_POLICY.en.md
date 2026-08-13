# Privacy Policy — Driftora

**Effective date:** August 13, 2026
**Operator ("we"):** Individual Entrepreneur Evgeny Yu. Tikhonenko, OGRNIP 326508100294665, INN 504414138460 ("Driftora")
**Contact:** support@family-pie.ru

Driftora is a mobile app for self-care: a thought journal (CBT/SMER), mood
check-ins, weight, steps and meal tracking. Your records live **on your device** in an
encrypted database. At your choice you can make an **encrypted backup**, which only you
hold, or enable **optional encrypted sync** — in both cases the **operator cannot read**
the content. There is no registration by email or phone. This policy explains what data
is processed, where it is stored and what exactly leaves the device.

## Summary

- The app works **without registration by email or phone**. Optional sync uses an
  anonymous key-account (a cryptographic key, not an email/password).
- The journal, mood, weight, steps and meals are stored on your device in an encrypted
  database. At your choice you can make an **encrypted backup** or enable **encrypted
  sync** — in both cases the **operator cannot read** the content.
- Only the **food recognition** — text or a photo of a dish — goes to the internet, and
  only if you yourself have enabled AI recognition.
- We do **not sell** your data and do **not show** third-party advertising.

## Where data is stored

The journal, mood, weight and meals are stored on your device in an encrypted database
(SQLCipher; the key is in the phone's secure storage). The operator has no access to
this database and cannot read it.

**Backup (at your choice).** You can export an **encrypted file** with all your data
and, through the system "Share" dialog, save it to **your own cloud** (iCloud, Google
Drive, or wherever you choose). The file is encrypted with a key that you hold; the
operator is not involved and cannot read it. For restoration on a new device there is a
**passphrase** (or key file) that you save and keep **yourself only** — the operator
never sees it. To simplify transfer within a single ecosystem, the master key may be
mirrored to the **iCloud Keychain / Google Block Store** of your own Apple/Google
account.

**Sync (optional, at your choice).** You can enable **encrypted sync** between your
devices. In that case the operator's server stores only the **unreadable ciphertext** of
your backup plus service metadata (see "What data is processed"); the operator does not
have the key to open it. This feature is **off by default** and is enabled only by you;
before it is enabled in production, the review from the "Governing law" section must be
completed (when enabled, the server is located in the Russian Federation).

## What data is processed

**On the device.** Thought-journal entries (situation, thoughts, emotions, reactions,
arguments, reappraisal), mood check-ins (0–10), weight by day, steps by day, food
records and their nutritional value, your goals and reminder times, settings flags. Some
of this is health and mental-state data (a "special category"); in plaintext it is
processed **on the device** and leaves it only as described below (encrypted backup or
sync — always as unreadable ciphertext).

**No identifying data.** The app does not request a name, email, phone, or precise
geolocation and does not link records to your identity. Data is tied only to the device.

**Sync metadata.** If you have enabled sync, the server receives an **encrypted snapshot
of the database** (unreadable ciphertext) and non-content metadata — the **public key**
of your anonymous key-account, a device identifier, the snapshot size and timestamps —
and, at the network level, your **IP address**. Decrypted records are **never**
transmitted to the server. This metadata is not encrypted and is the only new
information disclosed when sync is enabled.

## Data transfer during food recognition

If you have enabled AI food recognition, the text, photo or voice recording of a dish is
transmitted through our server to OpenRouter (OpenRouter, Inc., servers in the USA),
which performs the AI recognition of the foods. This is a
cross-border data transfer. Calories and macronutrients are calculated from a built-in
database, not by the neural network. The journal, mood, weight and any other records are
not transmitted. Recognition is off by default, is enabled manually, and is revoked in
settings. Before sending, the photo is downscaled and geotags are removed.

## Special category of data

Health and mental-state data (thought journal, mood, weight) is processed in
**plaintext** on the device. The operator and third parties do **not** receive its
readable content: it is not transmitted to the AI food-recognition service, and it
enters the encrypted backup and sync only as **unreadable ciphertext**, to which the
operator has no key.

## How data is used

- To show your records, goals and trends on the device itself.
- To send local reminders (which can be disabled in the phone's settings).
- To (if you have enabled AI recognition) identify foods from text or a photo — the
  figures are still taken from the built-in database.

## Legal bases (152-FZ)

Processing on the device is carried out in your interests and under your control.
Cross-border transfer for AI recognition is carried out **only on the basis of your
separate consent**, which you give in the app before the first transmission and can
revoke in settings. Backup and sync are also carried out **under your control and with
your consent** and are off by default. When sync is enabled, the encrypted snapshot is stored on the operator's server in the **Russian Federation**. The processing is recorded in the Roskomnadzor operator register (entry 77-26-554244, notification 82677/77 of 25 May 2026); a notification of cross-border transfer to the USA for AI recognition has been filed with Roskomnadzor.

## Transfer to third parties

The only recipient of **content** outside the device is the AI-recognition provider
(OpenRouter, Inc., USA), and only to the extent described in the "Data transfer during food
recognition" section. In addition:

- **A backup made at your initiative** goes to the **cloud you choose yourself** (iCloud,
  Google Drive, etc.) — as an encrypted file; such transfer is governed by the terms of
  the provider you chose, and the operator is not involved and cannot read the file's
  content.
- **Sync, if you enable it,** transmits to the operator on a server **in the Russian Federation** only
  the **unreadable ciphertext** and metadata (without decrypted records).

- **Subscription payment, if you take one out,** goes through **ЮKassa (YooMoney NBCO
  LLC, Russian Federation)**. Card details are entered on ЮKassa's side and are never
  passed to the operator; from ЮKassa the operator receives only the fact and status of
  the payment, its identifier and — if you provided one — the email address for the
  receipt. The journal, weight, mood and meals are not transmitted anywhere during
  payment.

We do not sell personal data and do not transfer it for advertising. Data may be
disclosed only if required by law.

## Storage and deletion

Records are stored on the device until you delete them or delete the app. You delete the
**backup** yourself — by deleting the file in your cloud. With **sync** enabled, deleting
the account/snapshot removes the ciphertext stored by the operator. Requests to the AI
service are processed ephemerally: content is not stored on the operator's server and is
not logged. The AI provider's (OpenRouter, Inc., USA) retention is governed by OpenRouter's terms and its data processing agreement.

## Your rights

At any time you manage your data directly on the device: you can change or delete
records, disable AI recognition, turn off sync, and delete backups. For **portability**
you do not need a request to the operator — you already hold the full encrypted export
of all your data as a backup file. Since the operator does not store your records in
plaintext (readable form), a separate request to it for access/correction/deletion of
their content is not required; when sync is enabled, the stored ciphertext is deleted by
deleting the account/snapshot. For other questions: support@family-pie.ru.

## Children

The app is not intended for children under 16. We do
not knowingly collect data from children under this age.

## Security

The on-device database is encrypted (SQLCipher), and the key is stored in the OS secure
storage (Keychain/Keystore). Transmission to the AI service goes over TLS. Backups and
sync are protected by **end-to-end encryption (E2E)**: data is encrypted with a key that
you hold, and the operator **does not have a key** capable of reading it — even on the
server only unreadable ciphertext is stored. No method of transmission or storage is
completely secure, but we strive to protect your data.

## Changes

We may update this policy. A new effective date is published here, and for material
changes, consent is requested again in the app.

## Contact

Individual Entrepreneur Evgeny Yu. Tikhonenko, OGRNIP 326508100294665, INN 504414138460 — support@family-pie.ru
