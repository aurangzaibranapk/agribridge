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

## Phase 2 — Customer commerce (implemented for Testing)

- Real product catalog, category/brand filters and stock presentation
- Cart, checkout, branch/shop pickup and delivery
- Order history and tracking
- Cash, khata, bank transfer, Easypaisa and JazzCash choices

## Phase 3 — Farmer services (implemented for Testing)

- Farmer 360 dashboard
- Separate milk and FMCG khata views
- Milk quality and Wednesday payment history
- Grain sale, machinery, veterinary and crop-doctor requests
- Submitted service-request history

## Phase 4 — Staff and dealer operations (implemented scope)

- Feature/action/scope-driven staff menus
- Permission-filtered staff product access and real dashboard counts
- Dealer product catalog, order submission/history and current payable summary
- Unsupported payment-taking and task-assignment controls are intentionally not shown as active actions

## Phase 5 — AI and notifications (Testing-ready foundation)

- Firebase push registration when the Testing Firebase secret is supplied
- Kisan AI chat, image upload and expert escalation
- Weather and operational alerts

## External activation still required (not an app-code task)

- Apply Testing database migrations through `381_mobile_order_tenant_guard.sql`
- Provide Testing Supabase/API and Firebase configuration secrets
- Production signing requires the owner's private upload keystore
- Play Console identity verification and closed test require the owner's Google account

No production credential belongs in Git.
