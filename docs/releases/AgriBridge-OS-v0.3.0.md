# AgriBridge OS v0.3.0 — Tenant Branding & Usage Release

Release status: implementation complete; ready for owner deployment

## Included

- Owner-only tenant brand settings page
- Brand name, logo URL, primary color and custom domain editing
- Custom-domain uniqueness and format validation
- Organization-owner update policy in Supabase
- Plan usage summary for active staff, active branches and products
- Starter, Business, Enterprise and Internal plan limit definitions
- Usage display remains read-only and does not change business records
- Existing My Work dashboard, ERP routes and old data preserved

## Database migration

- `502_tenant_owner_settings.sql`

## Verification

- Live policy verified on `organizations`
- `npm run build`: passed
- Static pages generated: 359/359
- `git diff --check`: passed
- No transaction, stock, finance or customer records modified

## Deployment note

Frontend hosting deployment and post-deploy smoke testing remain owner-side
actions. The release is pushed to GitHub `main`.

## Next planned version

`v0.4.0` — optional plan enforcement at tenant creation points and billing integration hooks.
