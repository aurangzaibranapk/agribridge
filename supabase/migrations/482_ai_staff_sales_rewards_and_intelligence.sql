-- AgriBridge — Migration 482
-- AI business intelligence + staff sales rewards.
--
-- AI remains read-only for analysis. Rewards are generated only from a
-- completed POS sale and are written to the existing append-only staff
-- credit ledger. Each daily threshold is unique, so retries cannot pay
-- the same reward twice.

create table if not exists public.staff_sales_reward_rules (
  id uuid primary key default gen_random_uuid(),
  threshold_amount numeric(14,2) not null check (threshold_amount > 0),
  reward_amount numeric(14,2) not null check (reward_amount > 0),
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (threshold_amount)
);

insert into public.staff_sales_reward_rules (threshold_amount, reward_amount, title)
values
  (10000, 200, 'Daily Sales Champion — Rs 10,000'),
  (50000, 1000, 'Daily Sales Star — Rs 50,000')
on conflict (threshold_amount) do update
set reward_amount = excluded.reward_amount,
    title = excluded.title,
    is_active = true;

create table if not exists public.staff_sales_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  sale_id uuid not null references public.pos_sales(id) on delete restrict,
  sale_date date not null,
  threshold_amount numeric(14,2) not null,
  reward_amount numeric(14,2) not null,
  title text not null,
  status text not null default 'credited' check (status in ('credited','reversed')),
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  unique (profile_id, sale_date, threshold_amount)
);

create index if not exists idx_staff_sales_rewards_profile_date
  on public.staff_sales_rewards(profile_id, sale_date desc);

alter table public.staff_sales_reward_rules enable row level security;
alter table public.staff_sales_rewards enable row level security;

drop policy if exists staff_sales_reward_rules_read on public.staff_sales_reward_rules;
create policy staff_sales_reward_rules_read on public.staff_sales_reward_rules
for select to authenticated using (public.fn_is_any_staff());

drop policy if exists staff_sales_rewards_read on public.staff_sales_rewards;
create policy staff_sales_rewards_read on public.staff_sales_rewards
for select to authenticated using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
      and p.role::text in ('owner','super_admin','admin','manager','finance','hr')
  )
);

-- A single source for category-wise sales, staff ranking and date-range AI
-- analysis. Category is rolled up to its top-level category when available.
create or replace view public.v_ai_sales_category as
with category_names as (
  select c.id,
         coalesce(parent.name, c.name, 'Uncategorized') as category_name
  from public.categories c
  left join public.categories parent on parent.id = c.parent_category_id
)
select
  s.created_at::date as sale_date,
  s.branch_id,
  s.shop_id,
  s.created_by as staff_id,
  coalesce(p.full_name, 'Unknown staff') as staff_name,
  coalesce(cn.category_name, 'Uncategorized') as category_name,
  sum(i.quantity)::numeric as units_sold,
  sum(i.subtotal)::numeric as sales_amount,
  count(distinct s.id)::integer as invoice_count
from public.pos_sales s
join public.pos_sale_items i on i.sale_id = s.id
left join public.products pr on pr.id = i.product_id
left join category_names cn on cn.id = pr.category_id
left join public.profiles p on p.id = s.created_by
where coalesce(s.status::text, 'completed') not in ('cancelled','void','voided','returned','refunded')
group by s.created_at::date, s.branch_id, s.shop_id, s.created_by,
         p.full_name, coalesce(cn.category_name, 'Uncategorized');

create or replace view public.v_ai_staff_sales_daily as
select
  s.created_at::date as sale_date,
  s.created_by as staff_id,
  coalesce(p.full_name, 'Unknown staff') as staff_name,
  s.branch_id,
  s.shop_id,
  sum(s.total_amount)::numeric as sales_amount,
  count(*)::integer as invoice_count
from public.pos_sales s
left join public.profiles p on p.id = s.created_by
where coalesce(s.status::text, 'completed') not in ('cancelled','void','voided','returned','refunded')
group by s.created_at::date, s.created_by, p.full_name, s.branch_id, s.shop_id;

create or replace view public.v_ai_staff_sales_monthly as
select
  date_trunc('month', s.created_at)::date as month_start,
  s.created_by as staff_id,
  coalesce(p.full_name, 'Unknown staff') as staff_name,
  sum(s.total_amount)::numeric as sales_amount,
  count(*)::integer as invoice_count
from public.pos_sales s
left join public.profiles p on p.id = s.created_by
where coalesce(s.status::text, 'completed') not in ('cancelled','void','voided','returned','refunded')
group by date_trunc('month', s.created_at)::date, s.created_by, p.full_name;

create or replace function public.fn_staff_sales_reward_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_sale_date date;
  v_daily_total numeric;
  v_reward_id uuid;
  v_staff_name text;
begin
  if new.created_by is null then return new; end if;
  if coalesce(new.status::text, 'completed') in ('cancelled','void','voided','returned','refunded') then return new; end if;

  v_sale_date := (new.created_at at time zone 'Asia/Karachi')::date;
  select full_name into v_staff_name from public.profiles where id = new.created_by;

  select coalesce(sum(total_amount), 0) into v_daily_total
  from public.pos_sales
  where created_by = new.created_by
    and (created_at at time zone 'Asia/Karachi')::date = v_sale_date
    and coalesce(status::text, 'completed') not in ('cancelled','void','voided','returned','refunded');

  for v_rule in
    select threshold_amount, reward_amount, title
    from public.staff_sales_reward_rules
    where is_active = true and threshold_amount <= v_daily_total
    order by threshold_amount
  loop
    insert into public.staff_sales_rewards
      (profile_id, sale_id, sale_date, threshold_amount, reward_amount, title)
    values
      (new.created_by, new.id, v_sale_date, v_rule.threshold_amount, v_rule.reward_amount, v_rule.title)
    on conflict (profile_id, sale_date, threshold_amount) do nothing
    returning id into v_reward_id;

    if v_reward_id is not null then
      insert into public.staff_credit_ledger
        (profile_id, ledger_type, source_type, amount, notes, created_by)
      values
        (new.created_by, 'credit', 'daily_sales_reward', v_rule.reward_amount,
         v_rule.title || ' — ' || coalesce(v_staff_name, 'Staff'), new.created_by);

      insert into public.notifications (recipient_user_id, title, message, link_url)
      values
        (new.created_by,
         'Mubarak! Sales reward hasil ho gaya',
         coalesce(v_staff_name, 'Staff') || ' ne aaj Rs ' || to_char(v_daily_total, 'FM999G999G999') ||
         ' ki sale cross ki. ' || v_rule.title || ': Rs ' || to_char(v_rule.reward_amount, 'FM999G999G999') || ' aapke staff credit mein jama hai.',
         '/admin/my-hr');

      insert into public.notifications (recipient_user_id, title, message, link_url)
      select p.id,
             'Staff achievement: ' || coalesce(v_staff_name, 'Staff'),
             coalesce(v_staff_name, 'Staff') || ' ne aaj ' || v_rule.title || ' hasil kiya — sale Rs ' || to_char(v_daily_total, 'FM999G999G999') || '. Team ko mubarakbad dein!',
             '/admin/hr-dashboard'
      from public.profiles p
      where p.is_active = true
        and p.role::text in ('owner','super_admin','admin','manager','sales_staff','finance','hr');
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_staff_sales_reward_on_sale on public.pos_sales;
create trigger trg_staff_sales_reward_on_sale
after insert on public.pos_sales
for each row execute function public.fn_staff_sales_reward_on_sale();

-- Agar sale baad mein void/return ho, to reward ko reverse bhi karein.
create or replace function public.fn_staff_sales_reward_reverse_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward record;
  v_staff_name text;
begin
  if old.created_by is null then return new; end if;
  if coalesce(old.status::text, 'completed') in ('cancelled','void','voided','returned','refunded') then return new; end if;
  if coalesce(new.status::text, 'completed') not in ('cancelled','void','voided','returned','refunded') then return new; end if;

  select full_name into v_staff_name from public.profiles where id = old.created_by;
  for v_reward in
    select id, reward_amount, title
    from public.staff_sales_rewards
    where sale_id = old.id and status = 'credited'
  loop
    update public.staff_sales_rewards
    set status = 'reversed', reversed_at = now()
    where id = v_reward.id;

    insert into public.staff_credit_ledger
      (profile_id, ledger_type, source_type, amount, notes, created_by)
    values
      (old.created_by, 'debit', 'sales_reward_reversal', v_reward.reward_amount,
       v_reward.title || ' — sale returned/voided' || coalesce(' — ' || v_staff_name, ''), old.created_by);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_staff_sales_reward_reverse_on_sale on public.pos_sales;
create trigger trg_staff_sales_reward_reverse_on_sale
after update of status on public.pos_sales
for each row execute function public.fn_staff_sales_reward_reverse_on_sale();

comment on table public.staff_sales_rewards is
  'Daily staff sales rewards. One reward per staff/date/threshold; credited to staff_credit_ledger (482).';
comment on view public.v_ai_sales_category is
  'Verified category/staff/shop sales source for AI Business Command Center (482).';
comment on view public.v_ai_staff_sales_monthly is
  'Monthly staff sales ranking source for awards and AI reporting (482).';
