-- =====================================================================
-- Migration 098: WhatsApp submissions + Manager ki lazmi approval
-- =====================================================================
-- Staff WhatsApp par saboot bhejta hai. Wo saboot yahan JYON KA TYON
-- rehta hai — kabhi overwrite ya delete nahi hota. AI jo samajhta hai wo
-- alag khane mein, aur manager jo theek karta hai wo teesre mein. Is
-- tarah baad mein poora silsila nazar aata hai: asal kya aaya, AI ne kya
-- samjha, manager ne kya kiya aur kyun.

create table if not exists whatsapp_submission_counters (
  year int primary key,
  last_number int not null default 0
);

create table if not exists whatsapp_submissions (
  id uuid primary key default uuid_generate_v4(),
  submission_number text not null unique,

  staff_profile_id uuid not null references profiles(id),
  branch_id uuid references branches(id),
  whatsapp_number text not null,

  -- ASAL SABOOT — ye teen khane kabhi nahi badalte.
  kind text not null check (kind in (
    'meter_opening','meter_closing','fuel','expense','cash_paid','cash_received','other'
  )),
  raw_text text,
  media_path text,
  media_mime text,

  -- AI ne kya samjha (asal se alag rakha gaya).
  ai_extracted jsonb,
  ai_summary text,

  original_amount numeric(12,2),
  corrected_amount numeric(12,2),

  flags jsonb not null default '[]'::jsonb,

  status text not null default 'pending' check (status in ('pending','approved','rejected','sent_back')),
  manager_profile_id uuid references profiles(id),
  manager_comment varchar(255),
  manager_media_paths text[],
  reviewed_at timestamptz,

  posted_reference_type text,
  posted_reference_id uuid,
  posted_at timestamptz,

  created_at timestamptz not null default now(),

  -- ===== HARD RULE =====
  -- Manager ka comment lazmi. Ye rok database mein hai, sirf code mein
  -- nahi — taake koi bhi raasta (naya code, seedhi SQL, koi aur tool)
  -- ise bypass na kar sake. Paise ke faisle par ek rok kaafi nahi hoti.
  constraint chk_manager_comment_required check (
    status = 'pending'
    or (
      manager_profile_id is not null
      and manager_comment is not null
      and length(btrim(manager_comment)) >= 5
    )
  )
);

create index if not exists idx_wa_sub_status on whatsapp_submissions(status);
create index if not exists idx_wa_sub_branch on whatsapp_submissions(branch_id);
create index if not exists idx_wa_sub_staff on whatsapp_submissions(staff_profile_id);
create index if not exists idx_wa_sub_kind on whatsapp_submissions(kind);
create index if not exists idx_wa_sub_created on whatsapp_submissions(created_at desc);

alter table whatsapp_submissions enable row level security;
alter table whatsapp_submission_counters enable row level security;

drop policy if exists staff_manage_wa_submissions on whatsapp_submissions;
create policy staff_manage_wa_submissions on whatsapp_submissions
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists staff_manage_wa_sub_counters on whatsapp_submission_counters;
create policy staff_manage_wa_sub_counters on whatsapp_submission_counters
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

-- Saboot financial hai (bills, cash receipts). Baqi buckets public hain,
-- magar ye jaan boojh kar PRIVATE hai — sirf signed URL se khulega, taake
-- link kisi ke haath lag jane par bhi kuch der baad bekar ho jaye.
insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-submissions', 'whatsapp-submissions', false, 10485760)
on conflict (id) do nothing;
