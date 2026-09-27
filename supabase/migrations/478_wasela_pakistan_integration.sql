-- =====================================================================
-- Migration 478: Wasela Pakistan Integration Toggle
-- =====================================================================
-- Wasela Pakistan credit par stock deta hai. Jab gahak Wasela Card se
-- POS par adaigi karta hai, to paisa seedha Wasela Pakistan ke paas
-- jata hai -- hamara dena un ke yahan usi waqt kam hota hai.
--
-- Pehle: waseela_card → Dr 1019 (Waseela Card wallet, asset) / Cr 4000
-- Naya:  waseela_card → Dr 2062 (Wasela Pakistan Dena) / Cr 4000
--         (jab integration enabled ho)
-- =====================================================================

-- 1) GL khata: Wasela Pakistan ka dena (payable/liability)
insert into gl_accounts (code, name, account_type, normal_side, is_active, sort_order)
values ('2062', 'Wasela Pakistan — Dena', 'liability', 'credit', true, 2062)
on conflict (code) do nothing;

-- 2) Settings table — baad mein aur bhi settings aayenge
create table if not exists system_settings (
  key         text primary key,
  value       text not null default 'false',
  description text,
  updated_at  timestamptz default now(),
  updated_by  uuid references auth.users(id)
);

-- RLS: sirf admin/owner dekh aur badal saken
alter table system_settings enable row level security;

create policy "system_settings: admin only read"
  on system_settings for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('super_admin', 'admin', 'owner')
    )
  );

create policy "system_settings: admin only write"
  on system_settings for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('super_admin', 'admin', 'owner')
    )
  );

-- 3) Default row: disabled
insert into system_settings (key, value, description)
values (
  'wasela_pakistan_enabled',
  'false',
  'Wasela Card POS adaigi Wasela Pakistan ke dene se linked karo. ON hone par Dr 2062 / Cr 4000.'
)
on conflict (key) do nothing;

-- service role ko bhi access chahiye (postJournal service client se chalti hai)
grant select, insert, update on system_settings to service_role;
grant select on system_settings to authenticated;
