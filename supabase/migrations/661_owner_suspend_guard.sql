-- 661: Owner ka account suspend, band, ya delete nahi ho sakta. Admin se bhi nahi.
-- Koi data update nahi. Sirf trigger.

create or replace function public.fn_guard_owner_account()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role::text = 'owner' then
      raise exception 'Owner account delete nahi ho sakta.';
    end if;
    return old;
  end if;
  if old.role::text = 'owner' and (
    coalesce(new.is_active, true) = false
    or coalesce(new.status::text, '') = 'suspended'
  ) then
    raise exception 'Owner account suspend ya band nahi ho sakta.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_owner_account on public.profiles;
create trigger trg_guard_owner_account
  before update or delete on public.profiles
  for each row execute function public.fn_guard_owner_account();
