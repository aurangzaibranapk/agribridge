# Security hardening plan (2026-10-16) — PLAN ONLY, nothing applied live

Source: Supabase advisors + read-only catalog queries on ktskwawkslaznkjjacni; callers from `rg rpc(...)/from(...)` in src.

| Finding | Count | Safe (migrations/) | Needs review (migrations-proposed/) |
|---|---|---|---|
| SECURITY DEFINER fns executable by anon | 138 | 105 → 546 (revoke anon/public, grant authenticated+service_role) | 33 → 548: 11 RLS-policy/view helpers, 20 called from shared actions/lib, 2 from portal/api |
| Owner-rights views (bypass RLS) | 82 (52 anon-readable) | 46 → 547 (revoke anon SELECT) | 6 anon-readable views used by portal/vendor pages; all 82 `security_invoker` → 549 |
| Functions without search_path | 112 | – | 550 (`public, extensions, pg_temp`) |
| Tables RLS on, no policy | 49 | – (already deny-all; INFO) | 4 read via user client → likely empty pages: ai_report_instructions, cycle_count_items, cycle_count_sessions, machinery_machine_counters |
| Leaked password protection | off | enable in Auth dashboard | – |

Order: backup → 546 → 547 → smoke test login, OTP, farmer portal, public site, POS → then review 548/549/550 one by one on a Supabase branch.
Classification data: `docs/security/*_classified.json`.
