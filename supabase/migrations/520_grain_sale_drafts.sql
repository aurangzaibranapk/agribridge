-- 520: Grain SALE -- "Draft (Admin approval)".
--
-- Boss (9 Oct 2026): khareed (518) ki tarah bikri bhi pehle draft ban sake.
-- Draft par kuch darj nahi hota: na stock nikalta hai, na batch, na lagat
-- (COGS) ka journal, na bardana/mazdoori ka kharcha. Admin parh kar Approve
-- kare to wohi asal bikri ka raasta (createGrainSale) bikri ki asal tareekh
-- par chalta hai.
--
-- SIRF izafa:
--   * naya table grain_sale_drafts (form ka poora payload)
--   * grain_sales.draft_id nullable + partial UNIQUE index (ek draft = ek bikri)
--   * features + feature_help ki nayi qatar (on conflict do nothing)
-- Koi purani row, column, function ya data nahi badla.

create table if not exists public.grain_sale_drafts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'approving', 'approved', 'rejected')),
  payload jsonb not null,
  sale_date date not null,
  grain_type text not null check (grain_type in ('wheat', 'rice', 'maize')),
  buyer_id uuid not null references public.buyers(id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity_kg numeric not null check (quantity_kg > 0),
  rate_per_kg numeric not null check (rate_per_kg > 0),
  total_amount numeric not null,
  bardana_cost numeric not null default 0,
  mazdoori_cost numeric not null default 0,
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
  approved_sale_id uuid references public.grain_sales(id),
  last_error text,
  constraint grain_sale_draft_reject_reason_check check (status <> 'rejected' or coalesce(btrim(reject_reason), '') <> '')
);

comment on table public.grain_sale_drafts is
  'Grain bikri jo Admin approval ka intezar kar rahi hai. Yahan se stock/batch/journal/kharcha kuch nahi hilta; Approve par asal grain_sales banti hai.';

create index if not exists grain_sale_drafts_status_idx on public.grain_sale_drafts (status, created_at desc);

alter table public.grain_sales add column if not exists draft_id uuid references public.grain_sale_drafts(id);
create unique index if not exists grain_sales_draft_uidx on public.grain_sales (draft_id) where draft_id is not null;
comment on column public.grain_sales.draft_id is
  'Agar ye bikri Admin approval se bani to us draft ki id. UNIQUE: ek draft se ek hi bikri.';

alter table public.grain_sale_drafts enable row level security;

-- Staff dekh sakta hai aur draft bana sakta hai. Update/delete policy nahi:
-- Approve / Reject / Edit sirf server action (owner/admin/super_admin ki
-- jaanch ke baad, service role) se.
drop policy if exists grain_sale_drafts_staff_select on public.grain_sale_drafts;
create policy grain_sale_drafts_staff_select on public.grain_sale_drafts
  for select using (fn_is_any_staff());
drop policy if exists grain_sale_drafts_staff_insert on public.grain_sale_drafts;
create policy grain_sale_drafts_staff_insert on public.grain_sale_drafts
  for insert with check (fn_is_any_staff() and status = 'pending' and created_by = auth.uid());

insert into public.features (key, label, route, icon, label_en)
values ('grain-procurement.sale-approvals', 'Anaj Bikri -- Admin Approval', '/admin/grain-procurement/sale-approvals', 'ClipboardCheck', 'Grain Sale Approval')
on conflict do nothing;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related)
values (
  'grain-procurement.sale-approvals', 'rm',
  'Anaj ki bikri jo "Draft (Admin approval)" par save hui -- Admin yahan parh kar Approve, Edit ya Reject karta hai.',
  'Owner / Admin / Super Admin.',
  'Jab staff ne bikri Draft par save ki ho -- khas kar purani tareekh ki bikri.',
  array[
    'Draft kholein: buyer, tareekh, godam, wazan, rate, kul raqam, bardana/mazdoori aur godam ka maujooda stock dekhein.',
    'Ghalti ho to Edit karein -- hisaab dobara banega.',
    'Sab theek ho to Approve dabayein: tab hi stock nikalega, lagat (COGS) ledger mein jayegi aur kharcha darj hoga (bikri ki asal tareekh par).',
    'Ghalat ho to Reject karein aur wajah likhein -- record mitta nahi.'
  ],
  'Approve ke baad bikri "Grain Bechein" ki history mein "Approved (Admin)" nishan ke sath milegi; wasooli wahin se.',
  array[
    'Godam mein utna stock na ho to Approve nahi hoga -- pehle khareed (approval) mukammal karein.',
    'Draft ka koi asar stock ya hisaab mein nahi hota.'
  ],
  '[]'::jsonb, array['grain-procurement.sell', 'grain-procurement.approvals']
)
on conflict do nothing;
