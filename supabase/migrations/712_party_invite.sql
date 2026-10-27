-- 712: Admin dealer / buyer (aur investor, vendor) invite.
--
-- ADDITIVE. Public kisan signup ko nahi chherta.
-- Account HR / Users se banta hai. WhatsApp, email ya SMS alag qadam hai.
-- Har bhejne ki poori lakeer party_invite_sends mein: kab, channel,
-- kis ko, poora paigham, aur nakaami ki wajah.
--
-- Live par mat chalayein jab tak backup verify na ho.
-- Pehle Testing. Rollback: 712_party_invite.rollback.sql

create table if not exists public.party_invite_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id),
  party_role text not null check (party_role in ('dealer', 'buyer', 'investor', 'machinery_vendor')),
  party_table text not null check (party_table in ('dealers', 'buyers', 'investors', 'machinery_vendors')),
  party_id uuid not null,
  full_name text not null,
  phone text not null,
  phone_key text not null,
  email text,
  branch_id uuid references public.branches(id),
  branch_name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists party_invite_accounts_org_idx
  on public.party_invite_accounts (organization_id, created_at desc);
create index if not exists party_invite_accounts_phone_idx
  on public.party_invite_accounts (phone_key);

create table if not exists public.party_invite_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.party_invite_accounts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  recipient text not null,
  subject text,
  content text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  sent_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists party_invite_sends_account_idx
  on public.party_invite_sends (account_id, created_at desc);

alter table public.party_invite_accounts enable row level security;
alter table public.party_invite_sends enable row level security;

revoke all on public.party_invite_accounts from public, anon, authenticated;
revoke all on public.party_invite_sends from public, anon, authenticated;
grant select on public.party_invite_accounts to authenticated;
grant select on public.party_invite_sends to authenticated;

drop policy if exists party_invite_accounts_admin_select on public.party_invite_accounts;
create policy party_invite_accounts_admin_select on public.party_invite_accounts
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.organization_id = party_invite_accounts.organization_id
        and p.role::text in ('owner', 'super_admin', 'admin')
    )
  );

drop policy if exists party_invite_sends_admin_select on public.party_invite_sends;
create policy party_invite_sends_admin_select on public.party_invite_sends
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.organization_id = party_invite_sends.organization_id
        and p.role::text in ('owner', 'super_admin', 'admin')
    )
  );

comment on table public.party_invite_sends is
  'Admin invite ki har koshish: kab, channel, recipient, poora paigham, wajah. Dekhein isi content ko kholta hai (712).';

-- Phone pehle se kisi party ka hai? Sirf service_role.
create or replace function public.fn_party_invite_phone_taken(p_key text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select coalesce(p_key, '') ~ '^[0-9]{10}$' and (
    exists (select 1 from public.fn_login_accounts_for_phone(p_key))
    or exists (select 1 from public.dealers d where public.fn_phone_key(d.phone_number) = p_key)
    or exists (select 1 from public.buyers b where public.fn_phone_key(b.phone_number) = p_key)
    or exists (select 1 from public.investors i where public.fn_phone_key(i.phone_number) = p_key)
    or exists (select 1 from public.machinery_vendors v where public.fn_phone_key(v.phone) = p_key)
    or exists (select 1 from public.party_invite_accounts a where a.phone_key = p_key)
  );
$$;

revoke all on function public.fn_party_invite_phone_taken(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_party_invite_phone_taken(text) to service_role;
  end if;
end $$;

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values (
  'hr.party-invite',
  'HR / Users',
  'HR / Users',
  'ایچ آر / صارف',
  'Admin dealer, buyer, sarmayakar ya vendor ka account banata hai aur WhatsApp, email ya SMS se invite bhejta hai. Pehle preview, phir timeline.',
  'Admin creates a dealer, buyer, investor or vendor account and sends an invite by WhatsApp, email or SMS. Preview first, then the timeline.',
  'ایڈمن ڈیلر، خریدار، سرمایہ کار یا وینڈر کا اکاؤنٹ بناتا ہے اور واٹس ایپ، ای میل یا ایس ایم ایس سے دعوت بھیجتا ہے۔ پہلے پیش نظارہ، پھر ٹائم لائن۔',
  '/admin/hr/users',
  'UserPlus',
  true,
  true
)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  description = excluded.description,
  description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  route = excluded.route,
  icon = excluded.icon,
  is_sensitive = true,
  is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('owner', 'hr.party-invite', array['view','edit']::text[], 'all'),
  ('super_admin', 'hr.party-invite', array['view','edit']::text[], 'all'),
  ('admin', 'hr.party-invite', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'hr.party-invite', 'rm',
  'Jin ka khud signup nahi — dealer, buyer, sarmayakar, vendor — un ka account Admin banata hai aur login ka paigham bhejta hai.',
  'Owner aur Admin. HR aur staff nahi. Kisan ka khud signup is safhe se nahi hota.',
  'Jab naya dealer ya buyer daftar se judna ho, aur pehli dafa OTP se login karna ho.',
  array[
    'HR / Users kholen.',
    'Role chunein: Dealer ya Buyer (ya Sarmayakar / Vendor).',
    'Naam, mobile, branch likhein. Email tab zaroori hai jab email se bhejna ho.',
    'Account banayein.',
    'WhatsApp, Email ya SMS dabayein. Pehle poora paigham dekhein, phir bhejein.',
    'Timeline mein Dekhein se wahi poora paigham khule. Nakaami ki wajah usi lakeer par.'
  ],
  'Mera Kaam par HR / Users. Account ke baad ek channel. Agla qadam: timeline mein Dekhein se poora paigham mila lo.',
  array[
    'Kisan ka public signup yahan se mat badlein.',
    'Email khali ho to email channel nahi jati — wajah timeline mein likhti hai.',
    'SMS tab jati hai jab Veevo set ho. WhatsApp us ki jagah khud nahi jata.',
    'Bheje baghair sirf preview. Jo gaya, wahi content record hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'hr.party-invite', 'en',
  'Admin creates accounts for people who do not self-signup — dealer, buyer, investor, vendor — and sends the login invite.',
  'Owner and Admin only. Not HR staff. This is not the public farmer signup.',
  'When a new dealer or buyer should join from the office and sign in the first time with OTP.',
  array[
    'Open HR / Users.',
    'Pick Dealer or Buyer (or Investor / Vendor).',
    'Enter name, mobile and branch. Email is required only for the email channel.',
    'Create the account.',
    'Press WhatsApp, Email or SMS. Read the full message, then send.',
    'Dekhein on the timeline opens that same full message. A failure shows its reason on the row.'
  ],
  'From Mera Kaam open HR / Users, create the account, send one channel, then Dekhein the timeline row.',
  array[
    'Do not change the public farmer signup from here.',
    'An empty email cannot be emailed — the reason is stored on the timeline.',
    'SMS sends only when Veevo is configured. It does not fall back to WhatsApp.',
    'Preview is not a send. The stored content is what was attempted.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('hr', 'hr.party-invite', 'Staff', 1, 15),
  ('admin', 'hr.party-invite', 'Users', 2, 20)
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;
