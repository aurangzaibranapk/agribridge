-- DELETE. Do not run until the owner approves, and only after the
-- read-only file shows the duplicate rows you expect.
-- This file was NOT executed on Live or Testing.
-- Keeps the earliest Shortlist row for M Usama Saleem in the
-- 22 October 2026 2:40–2:50 PM PKT window. Removes later duplicates only.

delete from public.application_activity_log
 where id in (
   select id from (
     select l.id,
            row_number() over (partition by l.application_id order by l.created_at, l.id) as rn
       from public.application_activity_log l
       join public.job_applications a on a.id = l.application_id
      where a.full_name ilike '%Usama Saleem%'
        and l.event_type = 'shortlisted'
        and l.event_description = 'Shortlist kiya gaya.'
        and l.created_at >= timestamptz '2026-10-22 14:40:00+05'
        and l.created_at <  timestamptz '2026-10-22 14:50:00+05'
   ) d
   where d.rn > 1
 );
