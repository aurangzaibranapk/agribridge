-- =====================================================================
-- Migration 219: Score ki qatar -- karobar pehle, hisaab baad mein
-- =====================================================================
-- MALIK KA USOOL: asal karobari qatar hi sach hai; Trust Engine us se
-- nikla hua nizam hai. Agar score ka hisaab kharab ho jaye to ASAL QATAR
-- NAHI GIRNI CHAHIYE -- aur nakami chhupni bhi nahi chahiye.
--
-- Ye do baatein aapas mein larti hain agar hisaab wahin trigger ke andar
-- lagaya jaye: trigger ke andar koi bhi ghalti poori transaction gira
-- deti hai. Yani kisan ka bill isi liye darj na ho ke score ka hisaab
-- lagta lagta ruk gaya. Wo bilkul ulti tarteeb hoti.
--
-- Is liye trigger hisaab lagata hi nahi. Wo sirf ek chhoti si parchi
-- qatar mein daalta hai: "is qatar ko dobara dekh lena". Us parchi mein
-- na koi hisaab hai, na koi rishta, na koi shart -- is liye us ka nakaam
-- hona amalan namumkin hai.
--
-- Asal hisaab baad mein chalta hai (fn_score_drain_queue), aur wahan har
-- parchi apni ghalti apne saath likhti hai. Karobar chalta rehta hai,
-- aur nakami saamne rehti hai.

create table if not exists score_sync_queue (
  id           bigserial primary key,
  source_table text not null,
  source_id    uuid not null,
  enqueued_at  timestamptz not null default now(),
  attempts     int not null default 0,
  status       text not null default 'pending' check (status in ('pending','done','failed')),
  last_error   text,
  processed_at timestamptz
);

-- Ek waqt mein ek hi muntazir parchi. Ek hi booking das dafa save ho to
-- das parchiyan nahi banti -- ek hi banti hai.
create unique index if not exists uq_score_queue_pending
  on score_sync_queue (source_table, source_id) where status = 'pending';

create index if not exists idx_score_queue_status on score_sync_queue (status, enqueued_at);

alter table score_sync_queue enable row level security;
drop policy if exists p_score_queue_read on score_sync_queue;
create policy p_score_queue_read on score_sync_queue for select
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));
grant select on score_sync_queue to authenticated;

-- Parchi daalne wala trigger -- is mein koi hisaab nahi.
create or replace function fn_score_enqueue()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into score_sync_queue (source_table, source_id)
  values (tg_table_name, new.id)
  on conflict do nothing;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'machinery_bookings', 'machinery_bills', 'machinery_payments',
    'farmer_credit_ledger', 'loan_installments',
    'milk_entries',
    'grain_procurement_entries', 'grain_procurement_payments',
    'agri_orders', 'agri_order_payments', 'agri_complaints',
    'staff_credit_ledger'
  ]
  loop
    execute format('drop trigger if exists trg_score_enqueue on %I', t);
    -- AFTER: asal qatar mehfooz likhi ja chuki hoti hai, tab parchi
    -- banti hai. Karobar pehle, hisaab baad mein.
    execute format(
      'create trigger trg_score_enqueue after insert or update on %I
       for each row execute function fn_score_enqueue()', t);
  end loop;
end $$;
