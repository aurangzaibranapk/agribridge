-- 597: Meta (WhatsApp) template registry. ADDITIVE ONLY.
-- WhatsApp broadcast sirf APPROVED template se jata hai (24 ghante ki window ke bahar free text mana).
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '^[a-z0-9_]{1,250}$'),
  lang text not null default 'ur',                 -- Meta language code: ur, en, en_US ...
  category text not null check (category in ('MARKETING','UTILITY')),
  body text not null,
  var_count integer not null default 0 check (var_count between 0 and 10),
  meta_status text not null default 'PENDING' check (meta_status in ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED')),
  synced_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, lang)
);
alter table public.message_templates enable row level security;
drop policy if exists message_templates_read on public.message_templates;
create policy message_templates_read on public.message_templates for select to authenticated
  using (public.fn_broadcast_can_create(auth.uid()));
drop policy if exists message_templates_write on public.message_templates;
create policy message_templates_write on public.message_templates for insert to authenticated
  with check (public.fn_broadcast_is_approver(auth.uid()));
drop policy if exists message_templates_update on public.message_templates;
create policy message_templates_update on public.message_templates for update to authenticated
  using (public.fn_broadcast_is_approver(auth.uid())) with check (public.fn_broadcast_is_approver(auth.uid()));
revoke all on public.message_templates from anon;
grant select, insert, update on public.message_templates to authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'broadcasts_template_fk') then
    alter table public.broadcasts add constraint broadcasts_template_fk foreign key (template_id) references public.message_templates(id);
  end if;
end $$;
