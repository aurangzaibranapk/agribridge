# Milk Control Center – Extension Plan
Branch: feat/milk-collection-masters

## Done
- Migration 530: milk_collectors + milk_chillars + links on milk_entries
- Collectors Master: /admin/milk-collection/collectors
- Chillars Master: /admin/milk-collection/chillars
- Control Center landing: /admin/milk-collection/control
- Control Entry: /admin/milk-collection/control-entry (real save with collector + chillar)
- Chillar Control: /admin/milk-collection/chillar-control
- Weekly Payment sheet: /admin/milk-collection/weekly-payment

## Remaining
- Dashboard cards (today totals, pending)
- Zero leakage alerts (quantity mismatch)
- Outward (company) reconciliation
- Payment entry from weekly sheet

## Rules
- Branch only. Live DB not touched.
- Owner approval required before merge.
- Apply migration 530 on testing first.
