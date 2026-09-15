-- =====================================================================
-- AgriBridge — POS ka test samaan saaf karna
-- =====================================================================
-- Test ke baad sab kuch hata deta hai: bikri, us ki qatarein, us ka
-- paisa, khata, stock ki harkat, batch, godam ka stock, cheezein, aur
-- gahak.
--
-- Tarteeb ahem hai -- pehle wo cheezein jo doosron ki taraf ishara karti
-- hain, phir wo jin ki taraf ishara hota hai. Ulta karne par foreign key
-- rok deti hai.
--
-- Cash book ki qatarein bhi jati hain, aur un ke jaane se balance khud
-- wapas apni jagah aa jata hai (127 ka trigger mitane par bhi chalta
-- hai) -- yani test ka paisa asli hisaab mein bacha nahi rehta.
-- =====================================================================

do $$
declare
  v_sales uuid[];
  v_txns uuid[];
begin
  select coalesce(array_agg(distinct s.id), '{}') into v_sales
  from pos_sales s
  join pos_sale_items si on si.sale_id = s.id
  join products p on p.id = si.product_id
  where p.name like 'ZZTEST %';

  select coalesce(array_agg(t.id), '{}') into v_txns
  from finance_transactions t
  where t.notes like '%ZZTEST%' or t.category like 'ZZTEST%';

  delete from journal_entry_sources where source_table = 'finance_transactions' and source_row_id = any(v_txns);
  delete from finance_transactions where id = any(v_txns);

  delete from khata_transactions where reference_sale_id = any(v_sales);
  delete from khata_accounts where crm_customer_id in (select id from customers where name like 'ZZTEST %')
                                or customer_id in (select id from customers where name like 'ZZTEST %');

  delete from pos_sale_payment_details where sale_id = any(v_sales);
  delete from pos_sale_items where sale_id = any(v_sales);
  delete from pos_sales where id = any(v_sales);

  delete from stock_movements where inventory_id in (
    select i.id from inventory i join products p on p.id = i.product_id where p.name like 'ZZTEST %'
  );
  delete from stock_batches where product_id in (select id from products where name like 'ZZTEST %');
  delete from inventory where product_id in (select id from products where name like 'ZZTEST %');
  delete from products where name like 'ZZTEST %';
  delete from customers where name like 'ZZTEST %';

  raise notice 'Test samaan saaf ho gaya.';
end $$;
