# AgriBridge OS v0.4.0 — Mobile phase 1 (proposed)

Release status: proposed. Not deployed. Migration 698 is a file only. Do not apply it until a fresh backup is confirmed.

The number `0.4.0` was previously reserved for optional plan enforcement. That work moves to a later version. This release is the shared portal + mobile version.

## Included

- Expo app in `apps/mobile` (package `pk.alranatraders.agribridge`, versionCode 2)
- One `VERSION` file for the portal package, the mobile package, and the Android versionName
- Login with the same portal accounts, then a local PIN or fingerprint
- Farmer wallet, khata, milk notices, weekly statement
- MCA attendance, meter, petrol, pickup, drop, offline queue
- MCO fat/LR and subah/shaam totals
- `APP_CHANNEL`: `debug` and `internal` show Masla batayein; `production` and anything unset hide it
- Production support reuses `/api/farmer-ai` and `/api/bridge-ai`, plus a WhatsApp link from `SUPPORT_WHATSAPP_E164` or website settings
- Android debug APK as the GitHub artifact `agribridge-mobile-debug-apk`

## Database migration

- `supabase/migrations/698_mobile_phase1.sql` — not applied on Testing or Live
- Rollback file sits beside it

## Not in this release

- Customer, staff, supplier, dealer, admin, and vet screens beyond navigation shells
- Farmer shop and orders
- Plan enforcement
- A device-measured cold start (the app records js-start to first-screen; this environment has no phone)
