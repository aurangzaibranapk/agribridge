# Daily Staff Motivation AI

## Scope

The first rollout is integrated into the existing AgriBridge My Work shell. It uses the existing staff performance score and does not create a second notification system.

## Rules

- No invented sales, targets, bonuses, or achievements.
- Score bands: 0-39 focus, 40-64 improving, 65-84 good, 85-100 excellent.
- Language follows the current staff language: Roman Urdu, Urdu, or English.
- Messages are short, respectful, and action-oriented.
- The deterministic rule engine is the fallback for missing data and AI/API failures.
- Future Gemini output must conform to StaffMotivation and remain scoped to the logged-in staff member and branch.

## Existing AgriBridge constraints preserved

- Permission-aware My Work layout.
- Existing notifications remain the single notification center.
- Load/Bill remains separate at /admin/load-bill.
- Product POS and service accounting remain separate.
- Layout must work on staff laptop, desktop, tablet, and large/small LED screens.

## Next backend step

When the live sales/target source is confirmed, pass salesAmount and targetAmount to StaffMotivationCard and optionally persist a daily notification through the existing notifications table with a stable daily deduplication key.
