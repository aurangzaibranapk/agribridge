# Pending Live deployment — 6 October 2026

- Inventory A–Z search, duplicate review, correction links merged in PR #25. Product detail route and POS permission UI fixed in PR #26. TypeScript, i18n and production build passed locally.
- Combined `.next` package: `agribridge-live-inventory-pos-20261006.tar.gz` (14,505,651 bytes; SHA256 `975b12b87d5094b53464b7753e3a1693d5d3c39d6309c481382264f10f5e1fe7`). cPanel upload/restart and live smoke test pending. GitHub build check is not deployment.
- Live: `sales_staff` lacks a `cash-handover` role row. Anwar Ul Hassan has only `view` personally; Sales Team has `send`. Testing has `send` for both. Existing migration 428 grants `send` with `own_records` scope.
- Before applying 428 to Live: verify full schema/data backup and file sizes; record permission and pending-shift counts; apply migration; verify counts and effective `send` access; then upload combined build, restart app, and smoke test. No cash amount or ledger row is changed by the permission migration.
