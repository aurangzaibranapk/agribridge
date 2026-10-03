# AgriBridge OS v0.2.0 — Tenant & Portal Release

Release status: implementation complete; ready for owner deployment

## Included

- AgriBridge OS product version shown on My Home
- Tenant organization metadata: brand name, logo URL, primary color and custom domain
- Subscription plan/status fields for future SaaS billing
- Tenant-safe organization read policy for normal authenticated users
- Public `/request-demo` organization onboarding form
- Super Admin organization request review page
- Approval flow that creates an organization, Main Branch and invited admin
- Custom-domain branding on the login page
- Trusted custom-domain OAuth callback redirect
- Database types aligned with the live tenant onboarding schema
- Existing My Work dashboard, ERP routes and old business data preserved

## Live migrations

- `500_saas_tenant_foundation.sql`
- `501_organization_signup_requests.sql`

## Verification

- `npm run build`: passed
- Static pages generated: 358/358
- `git diff --check`: passed
- Existing My Work layout: unchanged
- Data deletion or rewrite: none in this release

## Deployment note

Frontend hosting upload and production smoke testing remain owner-side actions.
This release is pushed to the GitHub `main` branch and can be deployed from the
owner's hosting panel.

## Next planned version

`v0.3.0` — tenant self-service settings, plan limits and operational SaaS billing hooks.
