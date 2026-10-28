-- 666: Mukammal transfer cancel nahi hoti. Doosri halat bhi wapas nahi hoti.

create or replace function public.fn_guard_completed_transfer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status::text = 'completed' and new.status::text is distinct from 'completed' then
    raise exception 'Mukammal transfer cancel ya wapas nahi ho sakti.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_completed_transfer on public.stock_transfers;
create trigger trg_guard_completed_transfer
  before update on public.stock_transfers
  for each row execute function public.fn_guard_completed_transfer();
