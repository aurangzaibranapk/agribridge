-- =====================================================================
-- AgriBridge — Migration 062: Fix Monthly Expenses Unique Constraint
-- =====================================================================
-- Old constraint didn't include branch_id, so two different chillers'
-- "electricity" entry for the same month would overwrite each other.

alter table monthly_expenses drop constraint if exists monthly_expenses_expense_month_expense_year_category_key;
alter table monthly_expenses add constraint monthly_expenses_month_year_category_branch_key
  unique (expense_month, expense_year, category, branch_id);