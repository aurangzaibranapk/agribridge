# Mobile delivery phases

## Current verified status

- Flutter static analysis: passing in GitHub Actions
- Automated tests: passing in GitHub Actions
- Android testing APK: building successfully
- Testing APK is retained as a downloadable workflow artifact for 14 days
- Live/production deployment remains intentionally disabled

## Phase 1 — Foundation (implemented)

- Flutter package and dependency definition
- ART/AgriBridge theme and reusable components
- Mobile OTP authentication contract
- Testing demo roles
- ERP role mapping
- Admin, Farmer, Staff and Dealer front dashboards
- Role-specific navigation
- Supabase environment separation

## Phase 2 — Customer commerce (front-end implemented)

- Real product catalog, category/brand filters and stock presentation
- Cart, checkout, branch/shop pickup and delivery
- Order history and tracking
- Cash, khata, bank transfer, Easypaisa and JazzCash choices

## Phase 3 — Farmer services (front-end implemented)

- Farmer 360 dashboard
- Separate milk and FMCG khata views
- Milk quality and Wednesday payment history
- Grain sale request and statement
- Machinery booking and wallet

## Phase 4 — Staff and dealer operations (front-end foundation implemented)

- Feature/action/scope-driven staff menus
- My Work, delivery, collection and stock request flows
- Dealer catalog, credit limit, order and payment flows

## Phase 5 — AI and notifications (secure foundation implemented)

- Firebase push registration
- Kisan AI chat, image upload and expert escalation
- Weather and operational alerts

## Phase 6 — Store release (blocked on external owner inputs)

- Android platform generation and compile require Flutter SDK
- Production signing requires the owner's private upload keystore
- Firebase file and production Supabase values must be supplied as secrets
- Play Console identity verification and closed test require the owner's Google account

No production credential belongs in Git.
