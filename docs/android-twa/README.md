# AgriBridge Android app (TWA) — Google Play

The Play app `pk.alranatraders.agribridge` (v1.0.0, versionCode 1) is a Trusted Web Activity that opens
https://alranatraders.pk/login. Generated with `@bubblewrap/core` 1.27 (`generate-twa.js`, `twa-manifest.json`),
built with JDK 17 + Android SDK 36, minSdk 24, targetSdk 36.

## Website requirements (this folder's PR)
- `public/.well-known/assetlinks.json` — package + SHA-256 of signing certs. After enabling **Play App Signing**,
  ADD the "App signing key certificate" SHA-256 from Play Console → Test and release → App integrity to
  `sha256_cert_fingerprints` (keep the upload-key one). Without it, the Play-installed app shows a URL bar.
- `/account-deletion` — Play "Data deletion" URL.
- Host blocks some bot user-agents (curl / Go-http-client / python get 403). Check that Google can read the file:
  `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://alranatraders.pk&relation=delegate_permission/common.handle_all_urls`
  If it errors, whitelist `/.well-known/` in cPanel ModSecurity / Imunify.
- Maintenance mode (`maintenance.on`) returns 503 for every path, including assetlinks.

## Upload key
Never commit the keystore. It lives outside the repo (owner keeps backup). The later Flutter app must use the
SAME package id, a higher versionCode, and the same upload key, so it ships as an update of this listing.
