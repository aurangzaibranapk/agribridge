-- Professional approval-gated support agent workflow.
-- Existing support tables and RLS remain unchanged; only assignment stage values expand.

alter table public.support_tickets
  drop constraint if exists support_tickets_assignment_status_check;

alter table public.support_tickets
  add constraint support_tickets_assignment_status_check
  check (
    assignment_status is null
    or assignment_status in (
      'queued',
      'dispatched',
      'analysis_requested',
      'analysis',
      'approval_required',
      'approved',
      'working',
      'blocked',
      'testing',
      'fixed',
      'completed',
      'failed'
    )
  );

comment on column public.support_tickets.assignment_status is
  'Professional support stages: analysis_requested, analysis, approval_required, approved, working, testing, fixed; legacy webhook stages remain supported.';
