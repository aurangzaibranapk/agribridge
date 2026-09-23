-- =====================================================================
-- AgriBridge — Migration 378: pos_collection_deposits — RLS bohat khula tha
-- =====================================================================
-- Malik ka spec "Test 7: bina ijazat URL/API access" -- Shop 360 ke
-- server actions (`src/actions/pos-collection.ts`,
-- `src/lib/pos/collection-outstanding.ts`, `src/lib/pos/shop-360.ts`)
-- SAB `createServiceClient()` (service role, RLS ko bypass karta hai)
-- istemal karte hain -- poore codebase mein isay browser-session wale
-- client se KABHI query nahi kiya jata (confirmed, grep se).
--
-- Is ke bawajood RLS `fn_is_any_staff()` par thi -- yani HR, warehouse,
-- procurement, milk_collection, machinery, admin_assistant, sales_staff
-- (12 roles mein se koi bhi) seedha Supabase client se (browser
-- devtools/curl, apna login token istemal kar ke, humara TypeScript
-- code bypass kar ke):
--   1. `SELECT` — poori company ke sab deposits parh sakta tha.
--   2. `UPDATE` — kisi bhi deposit ka `status` seedha 'approved' likh
--      sakta tha -- humari duplicate-settlement rok, SoD (khud tasdeeq
--      nahi), branch-scoping, ledger posting -- ye SAB TypeScript mein
--      hain, database mein koi bhi nahi. Seedha UPDATE un sab ko
--      bypass kar deta.
--   3. `INSERT` — koi bhi staff kisi bhi shop/staff ke naam jhooti
--      deposit claim bana sakta tha.
--
-- Kyunke asal app kabhi is raaste se guzarta hi nahi, is rok ko
-- tang karne se app mein KUCH nahi tootega -- sirf wo darwaza band
-- hota hai jo kabhi khula rehna hi nahi chahiye tha.
-- =====================================================================

drop policy if exists staff_read_pos_collection_deposits on public.pos_collection_deposits;
create policy staff_read_pos_collection_deposits on public.pos_collection_deposits
  for select
  using (fn_has_dept(array['owner','super_admin','admin','manager','finance']::public.user_role[]));

drop policy if exists staff_update_pos_collection_deposits on public.pos_collection_deposits;
create policy staff_update_pos_collection_deposits on public.pos_collection_deposits
  for update
  using (fn_has_dept(array['owner','super_admin','admin','manager','finance']::public.user_role[]))
  with check (fn_has_dept(array['owner','super_admin','admin','manager','finance']::public.user_role[]));

drop policy if exists staff_write_pos_collection_deposits on public.pos_collection_deposits;
create policy staff_write_pos_collection_deposits on public.pos_collection_deposits
  for insert
  with check (fn_has_dept(array['owner','super_admin','admin','manager','finance']::public.user_role[]));

comment on table public.pos_collection_deposits is
  'POS cash jo bank mein jama hui/honi hai. Asal app hamesha service role (createServiceClient) se yahan aata hai -- RLS sirf seedha API/client access ke against hai (378 se tang).';
