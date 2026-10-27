-- =====================================================================
-- AgriBridge — Migration 715: Self-merge ko Reject karna
-- =====================================================================
-- Pending Approvals par "Sprite Mint 1 Le" (source = target, status
-- pending) Reject is error par rukta hai:
--   new row for relation "product_merge_requests" violates check
--   constraint "product_merge_requests_not_self"
--
-- Yeh INSERT nahi. rejectProductMerge maujooda row UPDATE karta hai.
-- Postgres CHECK ki nakaami ko INSERT aur UPDATE dono par "new row"
-- kehta hai — update ke baad wali tuple bhi "new row" hai.
--
-- 693 ne check (source <> target) NOT VALID lagaya. Comment yeh tha ke
-- purani pending row chhoot jayegi aur sirf nayi rows rukengi. NOT VALID
-- sirf pehli scan chhodta hai. Baad ka har UPDATE usi purani self-merge
-- par dobara check karta hai, chahe sirf status / review_notes badle.
-- Is liye Reject fail hota hai. Table par koi trigger nahi jo nayi row
-- banaye.
--
-- Naya check: status = 'rejected' ho to source = target jaiz hai, taake
-- purani request band ho sake. Pending ya approved self-merge ab bhi
-- nahi — Approve stock khud par move karke product soft-delete kar deta,
-- is liye app pehle se rokta hai aur yeh check bhi approved self-row
-- nahi likhne deta.
-- NOT VALID is liye ke abhi jo pending self-merge pari hai, ADD
-- CONSTRAINT us par fail na ho. Reject ka UPDATE naya check pass karta
-- hai (status rejected). Koi data update / delete nahi.
--
-- Live par tab tak mat chalayein jab tak backup verify na ho.
-- Pehle Testing. Rollback: 715_product_merge_reject_self.rollback.sql

alter table public.product_merge_requests
  drop constraint if exists product_merge_requests_not_self;

alter table public.product_merge_requests
  add constraint product_merge_requests_not_self
  check (status = 'rejected' or source_product_id <> target_product_id)
  not valid;

comment on constraint product_merge_requests_not_self
  on public.product_merge_requests is
  'Nayi pending/approved self-merge (source = target) nahi. Purani pending self-merge ko Reject (status = rejected) karna jaiz hai. Approve nahi. NOT VALID taake 693 se pehle pari pending row migration rok na de (715).';
