# Al Rana Traders — AgriBridge Mobile

Role-aware Flutter application for Admin, Farmer, Staff and Dealer users. It shares the existing AgriBridge Supabase backend and never embeds a service-role key.

## CI

Every PR (and push to `main`) that changes `mobile/**` or the mobile migrations runs **Mobile CI**: `flutter analyze`, `flutter test`, a demo-mode debug APK (artifact `agribridge-demo-debug-apk`, no database keys), a targetSdk ≥ 35 check, and the PGlite SQL tests for migrations 583-588. Nothing is published to Google Play.

**Mobile Play Bundle** (manual) builds a signed `.aab` for `testing` or `production` (production only from `main`, only against the Live project). See `PLAY_STORE.md` and `MAIN_PORT.md`.

## Current foundation

- Premium ART/AgriBridge mobile design system
- Mobile OTP authentication
- Testing preview without database credentials
- Database-role to mobile-role routing
- Admin, Farmer, Staff and Dealer dashboards
- Role-specific bottom navigation and module hubs
- Existing granular feature/action/scope permission reader
- RLS-safe mobile repositories
- Push-device and account-deletion data contract
- Play Store release checklist

## Bootstrap Android project

Install Flutter stable, then from this directory run:

```bash
flutter create --platforms=android --project-name agribridge --org pk.alranatraders .
rm -f test/widget_test.dart
python3 tool/configure_android.py   # targetSdk >= 35, INTERNET in release manifest
flutter pub get
flutter test
flutter run \
  --dart-define=APP_ENV=testing \
  --dart-define=SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

The Android application ID must be `pk.alranatraders.agribridge`. Never pass the Supabase service-role key to Flutter.

Firebase Messaging remains off by default. Enable it only after adding the environment-specific Firebase Android configuration, using `--dart-define=FIREBASE_MESSAGING_ENABLED=true`.

## Testing preview

When Supabase variables are omitted, the login screen shows Admin, Farmer, Staff and Dealer preview buttons. This mode never writes to production data.

## Release build

```bash
flutter build appbundle --release \
  --dart-define=APP_ENV=production \
  --dart-define=SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Configure Android signing locally through `android/key.properties`; it is intentionally ignored by Git.
