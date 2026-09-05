-- 156: "Kya badla" -- sirf ye nahi ke "kisi ne badla"
--
-- audit_logs mein ab tak sirf ye likha jata tha: kis ne, kya kaam, kis
-- record par. Wo sawal ka aadha jawab hai. Asal sawal ye hota hai:
-- "kisan ka mobile number pehle kya tha?" Us ka jawab kahin nahi tha,
-- aur wohi sawal hafte baad poochha jata hai jab kisi ko phone nahi
-- milta.
--
-- Ab har tabdeeli ke sath ye bhi likha jata hai ke kaun se khane badle
-- aur pehle un mein kya tha. Sirf badle hue khane -- poori qatar nahi.
-- Poori qatar likhne ka matlab hota ke aadmi ko dobara wo do qatarein
-- mila kar dekhni parein, aur wo koi nahi karta.

alter table public.audit_logs
  add column if not exists changes jsonb;

comment on column public.audit_logs.changes is
  'Sirf badle hue khane: {"khane_ka_naam": {"pehle": ..., "ab": ...}}. Jo nahi badla wo yahan nahi aata.';

-- ---------------------------------------------------------------
-- Parhne ka haq: apna kaam har koi, sab ka kaam sirf bare log
--
-- Audit ka poora maqsad hi ye hai ke koi ise apni marzi se na badal
-- sake. Is liye likhne aur mitane ka koi rasta nahi -- qatarein sirf
-- SECURITY DEFINER logAudit se aati hain.
-- ---------------------------------------------------------------
alter table public.audit_logs enable row level security;

-- Purani INSERT policy ki shart "true" thi -- yani jo bhi login kiya
-- hua hai wo audit mein apni marzi ki qatar daal sakta tha. Audit ka
-- poora maqsad hi ye hai ke usay badla na ja sake; jis fehrist mein
-- koi bhi kuch likh sakta ho wo gawahi nahi rehti. Ab qatarein sirf
-- server ki taraf se aati hain (logAudit, service client se).
drop policy if exists staff_insert_audit_logs on public.audit_logs;
revoke insert, update, delete on public.audit_logs from authenticated, anon;
revoke all on public.audit_logs from anon;

drop policy if exists audit_logs_read on public.audit_logs;
drop policy if exists staff_view_audit_logs on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select using (
    actor_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'owner', 'super_admin', 'manager')
    )
  );

grant select on public.audit_logs to authenticated;
grant select, insert on public.audit_logs to service_role;

-- ---------------------------------------------------------------
-- Kisi bhi record ki tabdeeliyon ki fehrist
-- ---------------------------------------------------------------
create or replace view public.v_record_changes
with (security_invoker = true) as
select
  a.id,
  a.module,
  a.record_id,
  a.record_label,
  a.action_type,
  a.actor_name,
  a.actor_role,
  a.description,
  a.changes,
  a.created_at
from public.audit_logs a
where a.changes is not null;

revoke all on public.v_record_changes from anon;
grant select on public.v_record_changes to authenticated, service_role;

comment on view public.v_record_changes is
  'Har wo tabdeeli jis mein pata hai ke kya badla -- pehle kya tha aur ab kya hai.';
