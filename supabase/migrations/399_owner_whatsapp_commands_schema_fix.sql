-- Live par 10 September ko ek PEHLI koshish (`owner_whatsapp_commands` +
-- `admin_whatsapp_numbers`) bani thi, jis se koi bhi code kabhi jura hi
-- nahi -- adhoori chhoड़ di gayi thi. Wo purani table isi naam se ab
-- tak Live par khali (0 qatarein) padi hai.
--
-- Aaj (397) usi naam se NAYI, alag khaka wali table banane ki koshish
-- ki -- `create table if not exists` chup chaap chhoड़ deta hai jab
-- table pehle se ho, is liye Live par ye purani, be-mel khaka hi reh
-- jati (na `from_phone`, na `message`) aur naya code (/admin/owner-commands)
-- wahan crash ho jata.
--
-- Ye migration us purani khaka ko pehchan kar (naya `from_phone` khana
-- na ho to purani hai) hata deti hai -- SIRF is soorat mein, aur sirf
-- kyunke koi code kabhi is se jura hi nahi tha, aur khali hai.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'owner_whatsapp_commands'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'owner_whatsapp_commands' and column_name = 'from_phone'
  ) then
    drop table public.owner_whatsapp_commands cascade;
  end if;
end $$;

create table if not exists public.owner_whatsapp_commands (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  profile_id uuid references profiles(id),
  message text not null,
  status text not null default 'received' check (status in ('received', 'acknowledged', 'responded', 'done')),
  response_text text,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_owner_whatsapp_commands_status on owner_whatsapp_commands(status);

alter table owner_whatsapp_commands enable row level security;

drop policy if exists "Owner/Admin can view whatsapp commands" on owner_whatsapp_commands;
create policy "Owner/Admin can view whatsapp commands"
  on owner_whatsapp_commands for select
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));

drop policy if exists "Owner/Admin can update whatsapp commands" on owner_whatsapp_commands;
create policy "Owner/Admin can update whatsapp commands"
  on owner_whatsapp_commands for update
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]))
  with check (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));
