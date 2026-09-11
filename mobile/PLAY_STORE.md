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
- Support email and website
