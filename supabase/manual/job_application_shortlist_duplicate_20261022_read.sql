-- READ ONLY. Do not pair this with a delete.
-- Nothing in this file was run on Live or Testing.
-- Applicant M Usama Saleem, 22 October 2026, 2:44 PM Pakistan time (UTC+5).
-- Identifies duplicate "Shortlist kiya gaya." timeline rows in that window.

select l.id,
       l.application_id,
       a.full_name,
       l.event_type,
       l.event_description,
       l.created_at,
       l.created_at at time zone 'Asia/Karachi' as created_at_pkt
  from public.application_activity_log l
  join public.job_applications a on a.id = l.application_id
 where a.full_name ilike '%Usama Saleem%'
   and l.event_type = 'shortlisted'
   and l.event_description = 'Shortlist kiya gaya.'
   and l.created_at >= timestamptz '2026-10-22 14:40:00+05'
   and l.created_at <  timestamptz '2026-10-22 14:50:00+05'
 order by l.created_at, l.id;
