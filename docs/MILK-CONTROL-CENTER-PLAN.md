# Milk Control Center – Extension Plan
Branch: feat/milk-collection-masters

## Status
- Migration 530: milk_collectors + milk_chillars tables + links on milk_entries
- Collectors Master: page + actions + client
- Chillars Master: page + actions + client
- Control Center landing: /admin/milk-collection/control

## Remaining
- Daily Entry form: add collector_id + chillar_id selectors
- Chillar Control: inward/outward reconciliation view
- Weekly Payment sheet
- Dashboard cards (today totals, pending)
- Zero leakage alerts (quantity mismatch)

## Rules
- Branch only. Live DB not touched.
- Owner approval required before merge.
- Apply migration 530 on testing first.
