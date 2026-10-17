-- =====================================================================
-- 595: Kharid ki qeemat aur udhaar baqaya -- internet se band.
--
-- 17 October audit: `products` par public read policy
-- (public_read_available_products) hai aur `anon` role ke paas har
-- column ka SELECT tha -- yani website ki public key se koi bhi
-- `products.purchase_price` (hum kitne mein khareedte hain) parh sakta
-- tha. `stock_batches.unit_cost` aur `customers.current_balance` par bhi
-- anon ka column grant tha (wahan RLS rok raha tha, magar grant hona hi
-- nahi chahiye).
--
-- Kya badla:
--   * anon (aur PUBLIC) se in teen tables ka TABLE-level SELECT hataya,
--     phir baqi sab columns ka SELECT wapas diya -- sirf raaz wale
--     columns (purchase_price, unit_cost, current_balance) band.
--   * Public website ki product listing chalti rehti hai (name, price,
--     image, waghaira) -- wo purchase_price parhti hi nahi.
--   * authenticated (staff) par koi farq nahi.
--
-- Note: is ke baad in tables mein naya column anon ko khud-ba-khud nazar
-- nahi aayega -- zaroorat ho to us ka grant alag dena hoga.
--
-- Wapas: supabase/rollbacks/595_hide_cost_columns_from_public.down.sql
-- Additive: koi table/column/data nahi hatta. Dobara chalana mehfooz.
-- =====================================================================

do $$
declare
  t record;
  cols text;
  secret_cols text;
begin
  for t in
    select * from (values
      ('products',      array['purchase_price']),
      ('stock_batches', array['unit_cost']),
      ('customers',     array['current_balance'])
    ) as x(tbl, secret)
  loop
    if to_regclass('public.' || t.tbl) is null then
      continue;
    end if;

    execute format('revoke select on public.%I from anon', t.tbl);
    execute format('revoke select on public.%I from public', t.tbl);
    -- Column-level grant bhi saaf (pehle se diya gaya ho to).
    -- Sirf wohi raaz wale columns jo waqai maujood hain (purane/local DB mein
    -- koi column na ho to migration na girey).
    select string_agg(quote_ident(column_name), ', ')
      into secret_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = t.tbl and column_name = any (t.secret);
    if secret_cols is not null then
      execute format('revoke select (%s) on public.%I from anon', secret_cols, t.tbl);
    end if;

    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
      from information_schema.columns
     where table_schema = 'public'
       and table_name = t.tbl
       and column_name <> all (t.secret);

    if cols is not null then
      execute format('grant select (%s) on public.%I to anon', cols, t.tbl);
    end if;
  end loop;
end
$$;

comment on column public.products.purchase_price is
  'Kharid ki qeemat -- company ka raaz. anon ko SELECT nahi (595).';
