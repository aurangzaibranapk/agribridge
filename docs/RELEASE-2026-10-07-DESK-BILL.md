# Sales desk, POS closing and supplier bill release

Prepared 2026-10-07. Live deployment remains pending verified database backup and migrations. Existing business data is not deleted by this release.

## Changes

Load, bill and bank-transfer creation now writes source, journal and cash book in one database transaction. Customer loan/recovery and supplier payment creation use the same atomic posting path. New source guards reject unposted load, bank-transfer and supplier-payment rows. Reversal uses one atomic operation, including claimed cash-book entries; repeated reversal does not issue a second refund. Branch/staff sources and verified order payments receive database posting triggers.

Desk journals link to the staff's open POS shift. Closing preview and printed slip include load, bill, bank transfer, service charges, udhaar, recovery and incoming/outgoing totals by account. Query failures block closing instead of substituting zero. Historical closed cash snapshots remain unchanged.

Supplier bill totals derive strictly from the same row's quantity and trade rate, including unmapped CSV rows. CSV totals are ignored; row identities survive edits/removals. Unmapped rows block submission instead of silently disappearing. Product matching requires a unique identity; linking does not overwrite imported rates. New-product creation targets the selected row, and a database guard prevents duplicate active master identities. Drafts preserve unmapped lines and payment/discount/tax fields.

Tilth: 20 × 1,970 = 39,400. Screenshot subtotal would become 510,330 if all other rows remain unchanged, with zero discount/tax/payment. The full 27-row CSV was not supplied; this is a conditional calculation, not verification of every imported row. Read-only live inspection found no saved SB-2026-006 bill or Tilth master product to repair.

## Validation

TypeScript, production compilation and regression checks are required before release. Run `node tests/shift-desk-cash.cjs` and `node tests/supplier-bill-math.cjs`. SQL regression fixtures in `tests/sql` were tested on the testing project inside rolled-back transactions, including replay, failure rollback, reversal, shift linkage, duplicate products and deferred posting guards. No test data is retained.

## Live baseline before migration

Read-only counts: products 344 (297 active), purchases 10, purchase_items 112, load_transactions 11, journal_entries 686, journal_lines 2195, finance_transactions 327, unposted sources 0. Live bank_transfer_transactions and post_journal_atomic were absent. Compare counts after deployment and investigate any unexpected decrease. Historical finance-account discrepancies require reconciliation evidence and are not reset here.

## Deployment order

CLAUDE.md requires verified backup filename/size before live migrations. Stop the Node app for the migration/build-swap window: older separate-write code must not run alongside the new posting triggers.

Apply these migrations in this exact order, after backup verification:

1. `20260922092251_bank_transfer_service.sql`
2. `20261007030808_atomic_ledger_posting_and_source_triggers.sql`
3. `20261007040027_complete_branch_staff_and_order_payment_posting.sql`
4. `20261007040800_atomic_sales_desk_cash_and_party_linkage.sql`
5. `20261007043456_prevent_duplicate_product_master_identity.sql`

Verify database counts and service-only RPC permissions, then build using the existing production .env.local:

```bash
cd "/c/Users/Dx Home Films Lab 8K/Downloads/agribridge-live"
git pull --ff-only origin main
bash scripts/package-cpanel.sh
```

The command installs locked dependencies, validates production project settings, runs regressions and TypeScript, builds every route, hashes runtime files and creates a clean archive outside the project. It excludes source, documentation, caches, old archives, debug dumps, secrets and node_modules. It prints actual bytes/MB; do not add junk to reach an arbitrary 80–90 MB target. Keep the generated route baseline outside the project for subsequent releases.

On cPanel preserve .env.local, node_modules and user uploads. Move the previous .next to a recoverable backup; do not merge old and new .next contents. Extract the new runtime archive and run `node .release/verify.mjs` before restarting. The verifier rejects missing, changed and unexpected old build files. Smoke-test POS sale/return/closing slip, all five desk services and reversals, customer statement, supplier CSV editing, subtotal/discount/tax/payment/due and product linking. Accept live only after these checks. Identify old backups/debug files before moving them to Trash; no blanket directory deletion.

The workspace compile build has no production environment credentials and is not a deployable production archive. Current cPanel cleanup and live smoke tests are pending access/deployment. Whole purchase/GRN workflows still contain separate business writes; this release does not assert that every ERP operation is fully atomic.
