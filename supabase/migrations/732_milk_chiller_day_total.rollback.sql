-- 732 wapas. Chiller totals hat jate hain. Kisan ki adaigi nahi cherti.

drop trigger if exists milk_chiller_totals_guard on public.milk_chiller_totals;
drop policy if exists milk_chiller_totals_staff on public.milk_chiller_totals;
drop table if exists public.milk_chiller_totals;
drop function if exists public.fn_milk_chiller_total_guard();

update public.features set
  label = 'Chiller — FAT',
  label_en = 'Chiller — FAT',
  description = 'Chiller: thandak, FAT aur miqdar ka record.',
  description_en = 'Chiller: cooling, FAT and volume.',
  description_ur = 'چلر: ٹھنڈک، فیٹ اور مقدار۔'
where key = 'milk-collection.chiller';

update public.role_feature_permissions
set actions = array['view','edit','verify']::text[]
where feature_key = 'milk-collection.chiller'
  and role in ('manager', 'milk_collection');

update public.feature_help set
  purpose = 'Chiller: thandak, FAT aur miqdar ka record.',
  who_uses = 'Chiller ka staff.',
  when_use = 'Har collection ke baad.',
  how_steps = array['Miqdar aur FAT likhein.','Thandak ka darja likhein.'],
  next_step = 'Dispatch ke waqt yahi adad kaam aate hain.',
  mistakes = array['FAT andaze se na likhein -- adaigi usi par banti hai.'],
  related = '{}'::text[],
  updated_at = now()
where feature_key = 'milk-collection.chiller' and lang = 'rm';

delete from public.feature_help
where feature_key = 'milk-collection.chiller' and lang in ('en', 'ur');
