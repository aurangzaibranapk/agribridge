# AgriBridge OS v0.1.0 — Foundation Release

Release status: approved foundation baseline

## Included

- Unified login and role-based access foundation
- Owner Command Center
- Sidebar-free AgriBridge OS My Home with active module cards
- Existing staff My Work dashboard preserved
- ERP ka Naqsha with direct routes and new/existing feature tracking
- POS, inventory, stock count, finance, grain, milk, machinery and HR routes
- Daily Stock Count notification and pending popup reminder workflow
- Offline operational queue and sync foundation
- Supabase migration record and live data preservation rule

## Release rules

- Existing business records are not deleted or rewritten for a UI release.
- Database changes require a numbered migration and live verification.
- A release is not marked complete until `npm run build` passes.
- Every approved release gets a Git commit and matching version tag.

## Superseded by

`v0.2.0` — Tenant & Portal Release, documented in `docs/releases/AgriBridge-OS-v0.2.0.md`.
