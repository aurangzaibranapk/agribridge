-- =====================================================================
-- 657: doodh ke rate ki khuli policy — asal naam
-- =====================================================================
-- 656 ne public_read_milk_rate_settings hataya. Live par policy ka naam
-- public_read_milk_rates hai, is liye khuli SELECT bach jati thi aur har
-- login (kisan, dealer) rate parh sakta tha. Dono naam yahan bhi hain.

drop policy if exists public_read_milk_rate_settings on public.milk_rate_settings;
drop policy if exists public_read_milk_rates on public.milk_rate_settings;

drop policy if exists staff_read_milk_rate_settings on public.milk_rate_settings;
create policy staff_read_milk_rate_settings on public.milk_rate_settings
  for select to authenticated
  using (public.fn_is_any_staff());
