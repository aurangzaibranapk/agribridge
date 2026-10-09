-- 518: Grain entry "Pending (Admin approval)".
--
-- Boss ka usool (9 Oct 2026): khareed ka bill staff bana sake, magar stock,
-- ledger, cash book, wallet, kharche aur payment tab tak na hilen jab tak
-- Admin khud parh kar Approve na kare.
--
-- Ye migration SIRF izafa karti hai:
--   * naya table grain_pending_entries -- form ka poora payload (bori, cut,
--     chungi, kharche, payment, notes) yahan rakha jata hai. Is table se koi
--     posting nahi hoti.
--   * grain_procurement_entries par nayi nullable column pending_entry_id +
--     UNIQUE index: ek pending entry se sirf EK asal entry ban sakti hai
--     (dobara click / dobara approve par dusri entry database hi rok deta hai).
--   * features + feature_help ki nayi qatar (on conflict do nothing).
-- Koi purani column, function, row ya data badla/mitaya nahi gaya.

create table if not exists public.grain_pending_entries (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'approving', 'approved', 'rejected')),
  payload jsonb not null,
  receipt_photo_url text,
  entry_date date not null,
  grain_type text not null,
  farmer_id uuid references public.farmers(id),
  party_id uuid references public.grain_parties(id),
  warehouse_id uuid references public.warehouses(id),
  gross_weight_kg numeric,
  net_weight_kg numeric,
  bag_count numeric,
  total_amount numeric,
  payable_amount numeric,
  expenses_total numeric not null default 0,
  payment_amount numeric not null default 0,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz,
  edit_history jsonb not null default '[]'::jsonb,
  approval_claimed_at timestamptz,
  approval_claimed_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reject_reason text,
  approved_entry_id uuid references public.grain_procurement_entries(id),
  last_error text,
  constraint grain_pending_seller_check check (farmer_id is not null or party_id is not null),
  constraint grain_pending_reject_reason_check check (status <> 'rejected' or coalesce(btrim(reject_reason), '') <> '')
);

comment on table public.grain_pending_entries is
  'Grain khareed jo Admin approval ka intezar kar rahi hai. Yahan se stock/ledger/cash book/payment kuch nahi hilta; Approve par asal grain_procurement_entries banti hai.';

create index if not exists grain_pending_entries_status_idx on public.grain_pending_entries (status, created_at desc);

alter table public.grain_procurement_entries add column if not exists pending_entry_id uuid references public.grain_pending_entries(id);
create unique index if not exists grain_procurement_entries_pending_entry_uidx
  on public.grain_procurement_entries (pending_entry_id) where pending_entry_id is not null;
comment on column public.grain_procurement_entries.pending_entry_id is
  'Agar ye entry Admin approval se bani to us pending entry ki id. UNIQUE: ek pending se ek hi entry.';

alter table public.grain_pending_entries enable row level security;

-- Staff dekh sakta hai aur pending bana sakta hai. Update/delete ki koi policy
-- nahi: Approve / Reject / Edit sirf server action (owner/admin/super_admin
-- ki jaanch ke baad, service role) se hota hai.
drop policy if exists grain_pending_staff_select on public.grain_pending_entries;
create policy grain_pending_staff_select on public.grain_pending_entries
  for select using (fn_is_any_staff());
drop policy if exists grain_pending_staff_insert on public.grain_pending_entries;
create policy grain_pending_staff_insert on public.grain_pending_entries
  for insert with check (fn_is_any_staff() and status = 'pending' and created_by = auth.uid());

-- Naya safha features registry mein (feature_help ka FK isi par hai).
insert into public.features (key, label, route, icon, label_en)
values ('grain-procurement.approvals', 'Anaj Entry -- Admin Approval', '/admin/grain-procurement/approvals', 'ClipboardCheck', 'Grain Entry Approval')
on conflict do nothing;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related)
values (
  'grain-procurement.approvals', 'rm',
  'Anaj ki khareed jo "Pending (Admin approval)" par save hui -- Admin yahan parh kar Approve, Edit ya Reject karta hai.',
  'Owner / Admin / Super Admin.',
  'Jab staff ne entry Pending par save ki ho -- khas kar purani tareekh ki entry.',
  array[
    'Pending entry kholein: bechne wala, tareekh, bori, cut, chungi, kharche aur payment ka poora hisaab dekhein.',
    'Ghalti ho to Edit karein -- hisaab dobara banega.',
    'Sab theek ho to Approve dabayein: tab hi stock, ledger, cash book, khaata, kharche aur payment darj honge (entry ki asal tareekh par).',
    'Ghalat entry ho to Reject karein aur wajah likhein -- record mitta nahi, history mein rehta hai.'
  ],
  'Approve ke baad bill Anaj ki Kharid ki history mein "Approved" nishan ke sath milega.',
  array[
    'Pending entry ka koi asar stock ya hisaab mein nahi hota -- Approve se pehle bill ko asal na samjhein.',
    'Reject ki wajah saaf likhein taake staff dobara sahi entry kare.'
  ],
  '[]'::jsonb, array['grain-procurement']
)
on conflict do nothing;
