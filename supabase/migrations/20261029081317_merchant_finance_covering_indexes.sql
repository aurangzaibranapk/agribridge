-- Cover every new foreign-key lookup reported by the Postgres advisor.
create index if not exists idx_merchant_commission_rules_created_by
  on public.merchant_commission_rules(created_by) where created_by is not null;
create index if not exists idx_merchant_settlements_created_by
  on public.merchant_settlements(created_by) where created_by is not null;
create index if not exists idx_milk_qist_adjustments_created_by
  on public.milk_qist_adjustments(created_by) where created_by is not null;
create index if not exists idx_bridge_orders_commission_rule
  on public.bridge_orders(commission_rule_id) where commission_rule_id is not null;
create index if not exists idx_bridge_orders_guarantee_approved_by
  on public.bridge_orders(guarantee_approved_by) where guarantee_approved_by is not null;
