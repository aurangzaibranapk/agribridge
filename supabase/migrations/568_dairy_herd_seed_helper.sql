-- 568: Staff ka helper -- farmers.cow_count se khaali tag banana.
-- Sirf staff ke click par chalta hai. Koi khud-ba-khud backfill NAHI.
create or replace function public.fn_staff_seed_animals_from_cow_count(p_farmer uuid)
returns int language plpgsql security definer set search_path = public as $$
declare want int; have int; i int; n int := 0; tag text;
begin
  if not public.fn_is_staff(auth.uid()) then raise exception 'Sirf staff ye kar sakta hai'; end if;
  select coalesce(cow_count,0) + coalesce(buffalo_count,0) into want from farmers where id = p_farmer;
  if want is null then raise exception 'Kisan nahi mila'; end if;
  select count(*) into have from dairy_animals where farmer_id = p_farmer;
  i := have;
  while have + n < least(want, 200) loop
    i := i + 1; tag := 'T-' || lpad(i::text, 3, '0');
    continue when exists (select 1 from dairy_animals where farmer_id = p_farmer and lower(tag_no) = lower(tag));
    insert into dairy_animals (farmer_id, tag_no, species, status, notes)
    values (p_farmer, tag, 'cow', 'milking', 'Staff ne cow_count se banaya -- tafseel kisan bhare');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.fn_staff_seed_animals_from_cow_count(uuid) from public, anon;
grant execute on function public.fn_staff_seed_animals_from_cow_count(uuid) to authenticated;
