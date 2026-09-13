# Google Play release checklist

## Identity

- App name: Al Rana Traders — AgriBridge
- Package: `pk.alranatraders.agribridge`
- Category: Business
- Support website: `https://alranatraders.pk`
- Developer: ZR Technologies / Al Rana Traders

## Before closed testing

- Generate private upload keystore and configure Play App Signing.
- Add production Supabase URL and anon key through CI secrets.
- Add Firebase Android app and `google-services.json` outside public documentation.
- Host Privacy Policy and account-deletion instructions on the official website.
- Complete Data Safety declarations for profile, phone, orders, financial records, location and uploaded crop images.
- Provide reviewer credentials if authenticated screens must be reviewed.
- Verify target SDK against the current Play Console requirement.

## Protected GitHub secrets

The manual **Mobile Play Bundle** workflow only targets Testing and requires:

- `MOBILE_TEST_SUPABASE_URL`
- `MOBILE_TEST_SUPABASE_ANON_KEY`
- `MOBILE_TEST_API_BASE_URL` (Testing web/API deployment; never the Live URL)
- `MOBILE_ANDROID_KEYSTORE_BASE64`
- `MOBILE_ANDROID_KEY_ALIAS`
- `MOBILE_ANDROID_KEY_PASSWORD`
- `MOBILE_ANDROID_STORE_PASSWORD`
- `MOBILE_FIREBASE_ANDROID_JSON_BASE64` (optional until messaging test)

No production deployment is performed by this workflow.

## Tracks

1. Internal test for team devices.
2. Closed test for required testers and duration.
3. Production access application.
4. Staged rollout: 10%, 25%, 50%, 100%.

## Required store assets

- 512×512 app icon
- 1024×500 feature graphic
- At least 4 phone screenshots
- Short and full descriptions in English and Urdu
- Privacy Policy URL
- Account deletion URL: `https://alranatraders.pk/account-deletion`
- Support email and website

## Console declarations (do not guess)

- App access: provide a dedicated Testing reviewer login/OTP route.
- Ads: select **No** unless advertising is added later.
- Target audience: business users and adult farmers/dealers; do not mark as designed for children.
- Data Safety: declare phone/profile identifiers, orders, financial records, optional location and optional crop images exactly as used by the Testing build.
- Account deletion: enter `https://alranatraders.pk/account-deletion` and keep the in-app deletion request visible under Profile.
- Financial features: the app displays business ledgers/khata but does not issue loans or operate a wallet unless those regulated features are separately implemented and declared.

## Release gate

The bundle is ready for Internal testing only when all of these are green:

1. Testing migrations through `380_mobile_catalog_and_service_requests.sql` are applied.
2. Mobile CI Analyze, Tests and APK jobs pass.
3. Mobile Play Bundle workflow produces a signed `.aab` with Testing Supabase/API secrets.
4. OTP login, every role, permissions, order submission, service request, account deletion and notification token are smoke-tested on a physical Android device.
5. Store listing, privacy/Data Safety, app access and content-rating forms are complete.

Never upload a demo build or a bundle containing Live credentials to a Testing track.
