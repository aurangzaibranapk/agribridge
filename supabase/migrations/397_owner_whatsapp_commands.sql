-- Command Center Stage 2 (Step 1) -- malik WhatsApp par likh kar "is
-- issue ko resolve karo" jaisi baat keh sake, aur wo yahan darj ho.
--
-- USOOL wahi jo Data Health mein hai: koi bhi cheez khud theek nahi
-- hoti. Ye sirf DARJ karta hai ke malik ne kya kaha aur kab -- fix
-- hamesha alag se, insaan (Claude Code session) ki taraf se, malik ki
-- tasdeeq ke sath.
--
-- Sirf OWNER/SUPER_ADMIN ka WhatsApp number is raaste se guzarta hai
-- (staff-whatsapp-router.ts mein rok lagi hai) -- warna koi bhi staff
-- "database delete karo" jaisa paigham bhej kar tawajjah maang sakta.

create table if not exists owner_whatsapp_commands (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  profile_id uuid references profiles(id),
  message text not null,
  -- 'received'    -- abhi aaya, kisi ne dekha nahi
  -- 'acknowledged' -- malik ko turant "samajh gaya" bhej diya gaya
  -- 'responded'   -- Claude Code session ne jawab/tajweez likh diya
  -- 'done'        -- malik ne "haan" kaha aur kaam ho gaya
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

insert into features (key, label, label_en, label_ur, route, icon, is_sensitive, description, is_active)
values (
  'system.owner_commands', 'WhatsApp Commands', 'WhatsApp Commands', 'WhatsApp Commands',
  '/admin/owner-commands', 'MessageSquare', true,
  'Malik ne WhatsApp par jo kaha, uski fehrist aur jawab -- Command Center Stage 2 ka pehla qadam.',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, description = excluded.description, is_active = true;

insert into dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('master', 'system.owner_commands', 2, 'OVERVIEW', 1)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('admin', 'system.owner_commands', array['view','edit']::text[], 'all'),
  ('owner', 'system.owner_commands', array['view','edit']::text[], 'all'),
  ('super_admin', 'system.owner_commands', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'system.owner_commands', 'rm',
  'Malik ne WhatsApp par jo bhi kaha ("is booking ka masla theek karo" waghera) uski fehrist. Ye Command Center ka Stage 2 hai -- Stage 1 (Data Health) khud masle dhoondhta hai, ye safha unhein WhatsApp se aane wali hidayat ke sath jorta hai.',
  'Sirf Owner, Admin, Super Admin.',
  'Jab malik WhatsApp par koi hidayat bheje aur uska jawab/status dekhna ho.',
  array[
    'Malik ka WhatsApp paigham yahan "received" ke sath aata hai.',
    'Claude Code session usay dekh kar jawab likhta hai ("responded") -- ye jawab ABHI khud WhatsApp par wapas nahi jata, is safhe par padhna hota hai.',
    'Kaam ho jane par "done" mark karein.'
  ],
  'Agar jawab seedha WhatsApp par wapas chahiye (khud-kaar), us ke liye ek surakhshit API route aur secret chahiye -- ye agla qadam hai.',
  array[
    'Ye samajh lena ke paigham aana hi kaam ho jana hai -- asal fix ab bhi alag se, Claude Code session mein, malik ki tasdeeq ke sath hota hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;
