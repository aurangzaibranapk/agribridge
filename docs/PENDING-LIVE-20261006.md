# Pending Live deployment — 6 October 2026

- Inventory A–Z search, duplicate review, correction links merged in PR #25. Product detail route and POS permission UI fixed in PR #26. TypeScript, i18n and production build passed locally.
- Combined `.next` package: `agribridge-live-inventory-pos-20261006.tar.gz` (14,505,651 bytes; SHA256 `975b12b87d5094b53464b7753e3a1693d5d3c39d6309c481382264f10f5e1fe7`). cPanel upload/restart and live smoke test pending. GitHub build check is not deployment.
- Live: `sales_staff` lacks a `cash-handover` role row. Anwar Ul Hassan has only `view` personally; Sales Team has `send`. Testing has `send` for both. Migration 428 is in Live history but its role row has since disappeared. Migration 511 restores `send` while preserving other actions.
- Before applying 511 to Live: verify full schema/data backup and file sizes; record permission and pending-shift counts; apply migration; verify counts and effective `send` access; then upload combined build, restart app, and smoke test. No cash amount or ledger row is changed by the permission migration.

## Evening POS close slip and permission repair

- Closing a POS shift now opens `/admin/pos/shift/<id>/slip`; the print dialog opens automatically and the same URL can be reprinted. The slip shows saved expected/count cash, daily shift breakdown, handover status and office signature space. Printing alone does not record office receipt or change the ledger.
- Migration `511_restore_sales_staff_cash_handover_send.sql` applied and verified on Testing: `sales_staff` has `send` and the existing `view` action remains. Live migration history already includes 428, but its row later disappeared. Migration 511 on Live remains pending a fresh verified full backup and pre/post checks.
