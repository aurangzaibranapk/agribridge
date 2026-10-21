# DukanDost — Powered by AgriBridge ERP

Flutter app for small shopkeepers (kiryana, medical, hardware…). Urdu / English / Roman Urdu, offline-first.
Fully separate from AgriBridge: own app id (`pk.alrana.dukandost`), own Supabase schema (`dukandost`), meant for its **own Supabase project**.

## Run
```
flutter pub get
flutter run                       # local-only demo mode, OTP = 123456
flutter run --dart-define=DD_SUPABASE_URL=https://<dukandost-project>.supabase.co --dart-define=DD_SUPABASE_ANON_KEY=<key>
```
Never point it at the AgriBridge live/testing projects.

## Tests
- `flutter test` — unit + widget tests (repo logic, plan/trial, i18n, bill/PDF/ESC-POS, sync with a fake remote, UI flows).
- `PGURL=postgres://... supabase/tests/run_rls_tests.sh` — applies migrations on a plain Postgres with an auth shim and checks tenant isolation (RLS).
- `flutter test --update-goldens tool/screens_test.dart` — renders the 11 screens to `built/` for comparison with the mockups.
- Drift codegen: `dart run build_runner build -d` (generated `lib/data/db.g.dart` is committed).

## MVP status
Works: phone OTP (Supabase) + demo OTP, shop setup, 3 languages (Urdu RTL), items/stock, camera + Bluetooth-keyboard barcode, low-stock alerts,
POS (cash/JazzCash/Easypaisa/bank/udhaar, discount), bill text/PDF, share (WhatsApp via share sheet or wa.me), SMS, Bluetooth ESC/POS print,
customer/supplier khata with payments, promise date, WhatsApp reminder (prefilled, user presses send), purchases (stock + supplier payable), expenses,
dashboard, 4 reports (sale, P&L, udhaar aging, stock), Drift offline DB + push/pull sync, Free/Pro flags with 14-day trial (100-item free limit).

Stubbed / later: payment for Pro (Play Billing / JazzCash), PIN app lock, Google Drive/Excel export, multi-device conflict handling beyond last-write-wins
(bill numbers are per device), supplier-bill photo, staff roles (v2), automatic promise-day reminders (v2).
