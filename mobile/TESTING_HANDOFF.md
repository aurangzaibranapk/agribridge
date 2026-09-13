# AgriBridge mobile — real Testing handoff

This process is for the Testing environment only. It does not deploy or modify Live.

## One-time Testing setup

Apply Supabase migrations up to and including:

- `380_mobile_catalog_and_service_requests.sql`
- `381_mobile_order_tenant_guard.sql`

Add these GitHub Actions repository secrets:

- `MOBILE_TEST_SUPABASE_URL`
- `MOBILE_TEST_SUPABASE_ANON_KEY`
- `MOBILE_TEST_API_BASE_URL`
- `MOBILE_FIREBASE_ANDROID_JSON_BASE64` (optional; required only for push notifications)

Never place service-role keys, passwords or Live credentials in mobile build secrets.

## Build an installable real-data APK

1. Open GitHub **Actions**.
2. Select **Mobile Real Testing APK**.
3. Choose **Run workflow** on `testing/shop-360-zero-leakage`.
4. Type `TESTING ONLY` in the confirmation field.
5. Download the `agribridge-real-testing-apk` artifact after all steps pass.

## Physical-device smoke test

- OTP login and logout
- Admin, staff, dealer and farmer role routing
- Staff feature visibility matches web permissions
- Product catalog shows only the user's organization and assigned location stock
- Cart order submission and order history
- Farmer khata and service request submission/history
- Notification list, mark-all-read and optional Firebase delivery
- Profile, language, privacy and account-deletion request

If any check fails, do not move the build toward a store track.
