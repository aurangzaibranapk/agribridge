# AgriBridge mobile (Phase 1)

Expo / React Native app in this same repo. It talks only to the portal API (`EXPO_PUBLIC_PORTAL_URL`). The anon key is not in the app.

Shared product version is the repo `VERSION` file (`0.4.0`). Portal `package.json`, this `package.json`, and the Android `versionName` all read that file. Android `versionCode` is `2` (the old Play TWA was `1`). Package id: `pk.alranatraders.agribridge`.

## APP_CHANNEL — Masla batayein

Tester bug report is a build flavor, not a remote switch.

| `APP_CHANNEL` | Masla batayein | Support (chat + WhatsApp) |
| --- | --- | --- |
| `debug` | on | on |
| `internal` | on | on |
| `production` | off | on |
| unset, empty, or any other value | off | on |

Unset fails closed to production. `npx expo start` without `APP_CHANNEL` does **not** show Masla batayein.

```bash
cd apps/mobile
APP_CHANNEL=debug EXPO_PUBLIC_PORTAL_URL=https://alranatraders.pk npx expo start
```

EAS profiles in `eas.json` set the same flag: `debug`, `internal`, `production`. The GitHub debug APK workflow sets `APP_CHANNEL=debug`.

## Production support

Header action **Support** is on every signed-in screen, in every channel.

- Farmer chat posts to the existing portal route `/api/farmer-ai`.
- Staff chat posts to `/api/bridge-ai` (Abram).
- Other roles get WhatsApp only. The server decides the path (`supportChatPath`) and sends it on sync.

WhatsApp is configurable. There is no number in source. Order:

1. env `SUPPORT_WHATSAPP_E164` (portal server, not the app)
2. `website_settings` key `support_whatsapp`
3. `website_settings` key `contact_phone`

Empty or invalid (not 10–15 digits) means the link stays hidden. Login can still show WhatsApp before auth via public `GET /api/mobile/v1/support`.

## Offline

Field writes sit in a local outbox and sync with `client_uuid`. The server accepts pickup, drop, fat, attendance, meter, and petrol only for the roles that do that work. Fat is MCO or admin, and the collector cannot fat their own entry. Milk lists for an MCA are that rider's rows; an MCO sees their chiller, else their route. A successful sync also stores them in `mobile_sync_inbox` (migration 698) so a later phone can retry. A phone that never got online cannot hand its queue to a new phone.

## Signing

`signing/keystore.properties.example` has empty passwords. Copy it to `signing/keystore.properties` only on the machine that signs a Play build. Do not commit the keystore. Debug APK uses the debug keystore.

## CI artifact

Workflow **Mobile debug APK** uploads `agribridge-mobile-debug-apk` (14 days). The APK is not in git. It calls portal routes from this release, so login against live works after this release is deployed with the portal.
