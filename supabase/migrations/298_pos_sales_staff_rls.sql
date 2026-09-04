-- =====================================================================
-- AgriBridge — Migration 298: Apni hi bikri nazar nahi aa rahi thi
-- =====================================================================
-- 5 September, raat. Malik ne Rs 20 ki bikri ki, phir wapsi karne gaye
-- aur safhe ne kaha "koi bikri nahi mili". Bikri maujood thi -- Command
-- Center par Rs 20 saaf likha hua tha.
--
-- WAJAH: `pos_sales` aur `pos_sale_items` par RLS lagi hui thi, magar
-- policy sirf EK thi -- dealer ke liye (`dealer_id = current_dealer_id()`).
-- Dukan ke staff, manager, admin ya khud malik ke liye koi policy thi hi
-- nahi. Aur RLS ka usool ye hai ke jis ke liye policy na ho, us ke liye
-- jawab KHALI hota hai -- ghalti nahi, khali.
--
-- Yehi wo soorat hai jis par CLAUDE.md mein saaf likha hai:
--
--   "Ijazat wali rok ke peeche khali jawab ko asal adad na samjhein."
--
-- Bikri ho rahi thi kyunke `create_pos_sale` SECURITY DEFINER hai -- wo
-- RLS ke ooper se likhta hai. Yani likhna chal raha tha aur PARHNA band
-- tha. Ye farq mahinon chhupa reh sakta tha: bikri hoti rehti, adad
-- Command Center par aate rehte (wo doosre raaste se aata hai), aur jo
-- bhi safha seedha pos_sales parhta wo khali nazar aata -- aur har banda
-- samajhta ke "abhi koi bikri hui hi nahi".
--
-- Ab dukan wale apni dukan ki, shaakh wale apni shaakh ki, aur
-- owner/admin har bikri dekh sakte hain.
--
-- LIKHNE KA RAASTA YAHAN SE NAHI KHOLA JA RAHA. Bikri sirf
-- create_pos_sale se banti hai aur wapsi sirf fn_pos_return_lines se --
-- dono apne andar hisaab, stock aur khata sambhalte hain. Yahan sirf
-- PARHNE ki ijazat di ja rahi hai. Seedha insert ka darwaza kholna wo
-- raasta hai jahan se bikri to ban jati hai magar stock aur ledger
-- peeche reh jate hain.
-- =====================================================================

-- Kaun dekh sakta hai: is dukan ka banda apni dukan ki, shaakh ka banda
-- apni shaakh ki, aur owner/admin sab kuch.
create or replace function public.fn_can_see_sale(p_branch_id uuid, p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
     where p.id = auth.uid()
       and p.is_active
       and (
         p.role::text in ('owner','super_admin','admin')
         or (p_shop_id is not null and p.shop_id = p_shop_id)
         or (p_branch_id is not null and p.branch_id = p_branch_id)
       )
  );
$$;

comment on function public.fn_can_see_sale is
  'Bikri kis ko nazar aaye: apni dukan / apni shaakh / owner-admin ko sab (298).';

drop policy if exists staff_read_pos_sales on public.pos_sales;
create policy staff_read_pos_sales on public.pos_sales
  for select to authenticated
  using (public.fn_can_see_sale(branch_id, shop_id));

drop policy if exists staff_read_pos_sale_items on public.pos_sale_items;
create policy staff_read_pos_sale_items on public.pos_sale_items
  for select to authenticated
  using (
    exists (
      select 1 from public.pos_sales s
       where s.id = pos_sale_items.sale_id
         and public.fn_can_see_sale(s.branch_id, s.shop_id)
    )
  );

notify pgrst, 'reload schema';
