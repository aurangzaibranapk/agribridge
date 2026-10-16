# Milk Control Center – Extension Plan
Branch: feat/milk-collection-masters

## Done
- Migration 530: milk_collectors + milk_chillars + links on milk_entries
- Collectors Master: /admin/milk-collection/collectors
- Chillars Master: /admin/milk-collection/chillars
- Control Center landing: /admin/milk-collection/control
- Control Entry form: /admin/milk-collection/control-entry (collector + chillar select)
- Chillar Control: /admin/milk-collection/chillar-control (today inward summary)

## Remaining
- Real save in Control Entry (insert into milk_entries with collector_id + chillar_id)
- Weekly Payment sheet
- Dashboard cards (today totals, pending)
- Zero leakage alerts (quantity mismatch)
- Outward (company dispatch) reconciliation

## Rules
- Branch only. Live DB not touched.
- Owner approval required before merge.
- Apply migration 530 on testing first.
