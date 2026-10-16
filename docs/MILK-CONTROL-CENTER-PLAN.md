# Milk Control Center – Extension Plan
Branch: feat/milk-collection-masters

## Done
- Migration 530: milk_collectors + milk_chillars + links on milk_entries
- Collectors Master: /admin/milk-collection/collectors
- Chillars Master: /admin/milk-collection/chillars
- Control Center landing: /admin/milk-collection/control
- Control Entry: /admin/milk-collection/control-entry (real save)
- Chillar Control: /admin/milk-collection/chillar-control
- Weekly Payment sheet: /admin/milk-collection/weekly-payment
- Dashboard cards: /admin/milk-collection/dashboard
- Zero leakage alerts: /admin/milk-collection/alerts
- Company outward: /admin/milk-collection/outward

## Remaining (polish)
- Payment entry action from weekly sheet
- Stronger quantity mismatch alerts
- Better outward vs dispatch integration

## Rules
- Branch only. Live DB not touched.
- Owner approval required before merge.
- Apply migration 530 on testing first.
