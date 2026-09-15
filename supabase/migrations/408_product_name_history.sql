-- =====================================================================
-- AgriBridge — Migration 408: Naam ki tareekh (sirf ab se aagey)
-- =====================================================================
-- Malik (14 September): stock count ke dauran product ka naam theek
-- karne ka jab zikr hua, to us ne poocha "iska pehle naam kya tha aur
-- ab kya naam prove karne lage hain" — abhi naam badalne ka tajweez
-- (`product_edit_requests`) manzoor ho jata hai, magar "pehle kya tha"
-- kahin mehfooz nahi hota, sirf naya naam reh jata hai.
--
-- Malik ka faisla: purani tabdeeliyon ka hisaab nahi chahiye (wo kahin
-- mehfooz hi nahi thin, ab bana kar nahi de sakte) — sirf AB SE aagey
-- har tabdeeli darj honi chahiye. Isi liye ye ek generated column ya
-- backfill nahi -- sirf naya trigger, jahan se ye chalta hai wahi se
-- shuru hoga.
--
-- Bilkul `product_rate_history` (293) jaisa tareeqa -- sirf barhti hui
-- fehrist, kabhi khud nahi badalti, sirf trigger likh sakta hai.

create table if not exists public.product_name_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  old_name text not null,
  new_name text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table public.product_name_history is
  'Product ka naam kab kab badla -- sirf 14 September (408) ke baad ki tabdeeliyan, purani kahin mehfooz nahi thin.';

create index if not exists ix_name_history_product on public.product_name_history (product_id, changed_at desc);

alter table public.product_name_history enable row level security;

drop policy if exists name_history_read on public.product_name_history;
create policy name_history_read on public.product_name_history
  for select to authenticated
  using (public.fn_is_any_staff());

-- Likhna sirf trigger ka kaam -- haath se qatar daalne ka koi raasta
-- nahi, warna tareekh wo cheez nahi rehti jis par bharosa kiya ja sake.
revoke insert, update, delete on public.product_name_history from authenticated;

create or replace function public.fn_product_name_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name and old.name is not null then
    insert into product_name_history (product_id, old_name, new_name, changed_by)
    values (new.id, old.name, new.name, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_name_changed on public.products;
create trigger trg_product_name_changed
  after update of name on public.products
  for each row execute function public.fn_product_name_changed();

notify pgrst, 'reload schema';
