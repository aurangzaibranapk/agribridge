-- =====================================================================
-- AgriBridge — Migration 693: Product tabdeeli ka "pehle" mehfooz karna
-- =====================================================================
-- Malik (21 Oct 2026): approve karte waqt purana naam / purani qeemat
-- bhi dikhe. Ab tak `product_edit_requests.changes` mein sirf NAYI
-- qeematein thin. Ab request bhejte waqt jin fields ko badla ja raha hai
-- un ki us waqt ki qeemat `original` mein mehfooz hogi.
-- Purani requests ke liye `original` null rehta hai -- UI abhi ki (live)
-- product qeemat ko "pehle" dikhata hai (product approval tak nahi badalta).
--
-- Saath mein: product ko khud mein merge karna (source = target) band.
-- NOT VALID -- pehle se pari ek aisi pending request ko nahi chherta,
-- sirf nayi rows par lagta hai. Sirf izafa, kuch delete nahi.

alter table public.product_edit_requests
  add column if not exists original jsonb;

comment on column public.product_edit_requests.original is
  'Request ke waqt badalne wale fields ki purani qeemat (693 ke baad). Null = purani request.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_merge_requests_not_self') then
    alter table public.product_merge_requests
      add constraint product_merge_requests_not_self
      check (source_product_id <> target_product_id) not valid;
  end if;
end $$;
