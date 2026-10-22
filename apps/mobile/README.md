# AgriBridge mobile (Phase 1)

Expo / React Native app in this same repo. Login prefers `POST /api/mobile/v1/session` on `EXPO_PUBLIC_PORTAL_URL`. When that route is not on the live site yet, an email address signs in directly against the live Supabase project (`https://ktskwawkslaznkjjacni.supabase.co`) with the public anon key. Phone, CNIC, and username still need the portal route, because `fn_login_resolve` is service-role only. The anon key is a CI secret (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), not a committed value. Any other Supabase host is refused.

The app version is `AGRIBRIDGE_OS_VERSION` in `src/lib/app-version.ts` (currently `v0.6.1 Beta`). Expo reads that file at build time. Android `versionCode` is `major * 10000 + minor * 100 + patch` (601). A sideload rebuild can set `AGRIBRIDGE_VERSION_CODE` only when that integer is higher (the phone build is 605) while versionName stays `v0.6.1 Beta`. The old Play TWA was versionCode 1. CI fails if the Expo version or the default versionCode disagree with the portal constant. Package id: `pk.alranatraders.agribridge`. The npm `package.json` version is not the product version.

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

## Sideload test APKs

Phase 2 homes (admin, farmer, customer, staff) read the live project with the signed-in user JWT and existing RLS. They do not wait for `/api/mobile/v1/*`. A denied query stays a message, and an empty finance list is not shown as Rs 0.

Workflow **Mobile sideload APKs** builds two release APKs, not the fat debug APK. `APP_CHANNEL=internal`, versionName `v0.6.1 Beta`, versionCode 605 (`AGRIBRIDGE_VERSION_CODE`). R8 minify and Hermes are on. Each APK is one ABI (`arm64-v8a` or `armeabi-v7a`) and is signed with the Android debug keystore. minSdk is 24, so Android 8 and newer can install. `android:testOnly` is rejected by `apps/mobile/scripts/verify-sideload-apk.sh`. The job fails if the live Supabase URL or anon key secret is missing. The phone keeps the Supabase refresh token and renews the access token on foreground, on a timer, and once after PostgREST `JWT expired`. If that refresh is rejected, the app returns to login with `Session khatam ho gayi. Dobara login karein.` Raw HTTP and JSON appear only when `APP_CHANNEL=debug`. Internal and production stay on the short Urdu line. On an internal build, an admin or owner can open `Role dekho` to preview another role. That preview does not change the JWT, hides write actions, and the test-account `Role badlo` switcher is unchanged.

## CI artifact

Workflow **Mobile debug APK** uploads `agribridge-mobile-debug-apk` (14 days). The APK is not in git. Email login and the phase 2 homes read live Supabase before the portal build is uploaded. Sync, feedback, support chat, and non-email login still need this PR's portal routes on alranatraders.pk.
