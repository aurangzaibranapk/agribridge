-- =====================================================================
-- AgriBridge — Migration 259: Purchase ki manzoori, wapas bhejna, baat
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam F.
--
-- Ab tak purchase ka ek hi raasta tha: bani (pending) -> receive. Bill
-- se AI ka banaya draft aur sheet se charhi purchase bhi seedha receive
-- ho sakti thi -- yani jo cheez AI ne parhi, us par kisi ne haan nahi
-- kahi aur maal andar, dena charh gaya.
--
-- Ab har purchase par ek jaanch ka darja hai (review_status):
--
--   submitted   manzoori baqi -- draft AI ka ho, sheet ka ho, ya staff
--               ne haath se banayi ho
--   sent_back   manzoor karne wale ne wapas bheja, sawal ke sath;
--               banane wala jawab de kar dobara bhejta hai
--   approved    manzoor -- ab receive ho sakti hai
--   rejected    radd (purchase ka status bhi cancelled)
--
-- Purani purchases 'approved' rehti hain (default) -- un par kuch nahi
-- badalta. Owner/Admin ki haath se banayi purchase bhi seedha approved:
-- jo banda manzoor karne wala hai, us se apni hi cheez manzoor karwana
-- kaghazi karwai hai.
--
-- Receive ka taala database par hai, form par nahi: bina manzoori
-- receive ho hi nahi sakta, chahe koi purana form use kare.
--
-- Baat (purchase_comments) alag table mein, kabhi mitti nahi. "Ye rate
-- zyada kyun hai?" -- "Bill par yehi hai, tasveer dekhein" -- ye
-- silsila purchase ke sath rehta hai.
-- =====================================================================

alter table purchases
  add column if not exists review_status text not null default 'approved',
  add column if not exists reviewed_by uuid references profiles(id),
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_purchase_review_status') then
    alter table purchases
      add constraint chk_purchase_review_status
      check (review_status in ('submitted', 'sent_back', 'approved', 'rejected'));
  end if;
end;
$$;

create index if not exists idx_purchases_review_status
  on purchases (review_status) where review_status <> 'approved';

comment on column purchases.review_status is
  'submitted = manzoori baqi, sent_back = wapas bheja, approved = manzoor (receive ho sakti hai), rejected = radd (259).';

-- ---------------------------------------------------------------------
-- Taala: bina manzoori receive nahi
-- ---------------------------------------------------------------------
create or replace function fn_no_receive_without_approval()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'received' and old.status is distinct from 'received'
     and new.review_status <> 'approved' then
    raise exception
      'Purchase % abhi manzoor nahi hui (%). Pehle manzoori, phir receive.', new.purchase_number, new.review_status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_no_receive_without_approval on purchases;
create trigger trg_no_receive_without_approval
  before update of status on purchases
  for each row execute function fn_no_receive_without_approval();

-- ---------------------------------------------------------------------
-- Baat
-- ---------------------------------------------------------------------
create table if not exists purchase_comments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  author_id uuid references profiles(id),
  kind text not null default 'comment',
  body text not null,
  created_at timestamptz not null default now(),
  constraint chk_purchase_comment_kind
    check (kind in ('comment', 'submit', 'send_back', 'approve', 'reject', 'resubmit'))
);

create index if not exists idx_purchase_comments_purchase
  on purchase_comments (purchase_id, created_at);

comment on table purchase_comments is
  'Purchase par baat aur faisle ka silsila: sawal, wapas, manzoor, radd (259). Kabhi mitta nahi.';

alter table purchase_comments enable row level security;

drop policy if exists purchase_comments_read on purchase_comments;
create policy purchase_comments_read on purchase_comments
  for select to authenticated using (public.fn_is_any_staff());

drop policy if exists purchase_comments_insert on purchase_comments;
create policy purchase_comments_insert on purchase_comments
  for insert to authenticated
  with check (public.fn_is_any_staff() and author_id = auth.uid());
