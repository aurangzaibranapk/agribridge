-- 528: Approval queue gaps (fix/approval-queue-gaps). Additive. NOT applied.
-- 1) POS wapsi: manager apna hi code laga kar apni counter wapsi manzoor nahi kar sakta.
-- 2) POS wapsi: baad ka Admin review qatar (admin_review_status).

alter table public.pos_returns
  add column if not exists admin_review_status text not null default 'pending'
    check (admin_review_status in ('pending', 'approved', 'flagged')),
  add column if not exists admin_reviewed_by uuid references public.profiles(id),
  add column if not exists admin_reviewed_at timestamptz,
  add column if not exists admin_review_note text;

-- Purani wapsiyan qatar mein na bharen: 7 din se purani ko 'approved' (legacy) maan lo.
update public.pos_returns
   set admin_review_status = 'approved', admin_review_note = 'legacy (528 se pehle)'
 where admin_review_status = 'pending' and created_at < now() - interval '7 days';

create index if not exists idx_pos_returns_admin_review
  on public.pos_returns (admin_review_status, created_at desc);

create or replace function public.fn_pos_return_no_self_code()
returns trigger language plpgsql as $$
begin
  if new.created_by is not null and new.authorized_by = new.created_by then
    raise exception 'Apna hi manager code laga kar wapsi nahi ho sakti — doosre manager/Admin ka code chahiye.';
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_return_no_self_code on public.pos_returns;
create trigger trg_pos_return_no_self_code
  before insert on public.pos_returns
  for each row execute function public.fn_pos_return_no_self_code();

-- Review sirf Owner/Admin, aur na counter wala na code wala.
create or replace function public.fn_pos_return_review_guard()
returns trigger language plpgsql as $$
begin
  if new.admin_review_status is distinct from old.admin_review_status then
    if old.admin_review_status <> 'pending' then
      raise exception 'Is wapsi ka review ho chuka hai.';
    end if;
    if new.admin_reviewed_by is null
       or new.admin_reviewed_by = old.created_by
       or new.admin_reviewed_by = old.authorized_by then
      raise exception 'Wapsi ka review doosra Owner/Admin kare.';
    end if;
    if not exists (select 1 from public.profiles p where p.id = new.admin_reviewed_by
                   and p.role::text in ('owner', 'admin', 'super_admin') and p.is_active) then
      raise exception 'POS wapsi ka review sirf Owner/Admin kar sakta hai.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_return_review_guard on public.pos_returns;
create trigger trg_pos_return_review_guard
  before update on public.pos_returns
  for each row execute function public.fn_pos_return_review_guard();
