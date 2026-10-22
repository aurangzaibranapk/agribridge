-- 704 rollback. Testing par. Live par mat chalana.

drop policy if exists app_goal_targets_read on public.app_goal_targets;
revoke all on table public.app_goal_targets from authenticated;
drop table if exists public.app_goal_targets;
