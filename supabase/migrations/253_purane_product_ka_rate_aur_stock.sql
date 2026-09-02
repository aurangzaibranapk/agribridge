-- =====================================================================
-- AgriBridge — Migration 253: Purane product ka rate ek hi darwaze se
-- =====================================================================
-- Malik ki baat: "ek naam ka product agar hai to rate aur quantity to
-- update ho jani chahiye us product par."
--
-- Baat theek hai. Sheet har mahine aati hai, aur us mein zyada tar wohi
-- products hote hain jo pehle se maujood hain -- naye rate ke sath. Har
-- dafa "pehle se hai" keh kar chhoR dena us sheet ko bekaar kar deta
-- hai.
--
-- ---------------------------------------------------------------------
-- Magar rate badalne ka darwaza ek hi rehna chahiye
-- ---------------------------------------------------------------------
-- Trade rate ab teen jagah se badal sakta hai: supplier ke bill se
-- (248), sheet se, aur "Rate Baqi" wale safhe se. Agar teenon apna apna
-- update likhein to teen soorat banti hain jahan rate charh gaya magar
-- indraj nahi hua -- aur us ka pata us din chalta hai jis din koi
-- poochhta hai "ye cheez pehle 240 ki thi, ab 310 ki kyun hai?"
--
-- Is liye rate charhane ka darwaza ek hi hai. fn_apply_bill_line_rate
-- (248) bill ke liye tha; ye us ka aam bhai hai -- kahin se bhi rate
-- charhe, teen kaam ek sath hote hain: rate likhna, "abhi maloom nahi"
-- ka nishan hatana, aur indraj karna.
--
-- ---------------------------------------------------------------------
-- Jo NULL bheja jaye wo NAHI badalta
-- ---------------------------------------------------------------------
-- Sheet mein aksar sirf trade rate hota hai, sale rate nahi. Us soorat
-- mein sale rate ko haath lagana ghalat hai -- jo khana sheet mein hai
-- hi nahi, us ke baare mein sheet kuch keh hi nahi rahi. Khali ka
-- matlab "mat chheRo" hai, "sifar kar do" nahi.
-- =====================================================================

create or replace function fn_set_product_rates(
  p_product_id uuid,
  p_sale      numeric default null,
  p_trade     numeric default null,
  p_wholesale numeric default null,
  p_source    text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_trade numeric(12,2);
  v_trade_pend boolean;
  v_changed text[] := array[]::text[];
begin
  if not exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.is_active
       and p.role::text in ('owner','super_admin','admin','warehouse')
  ) then
    raise exception 'Rate badalna sirf Owner, Admin ya Warehouse wale ka kaam hai.';
  end if;

  if p_source not in ('manual', 'supplier_bill', 'intake', 'import') then
    raise exception 'Rate ka source theek nahi: %', p_source;
  end if;

  select purchase_price, trade_rate_pending into v_old_trade, v_trade_pend
    from products where id = p_product_id for update;

  if not found then
    raise exception 'Product nahi mila.';
  end if;

  -- Sale rate: sifar qabool nahi. products.selling_price NOT NULL hai,
  -- is liye "maloom nahi" ki jagah 0 para rehta hai -- aur 0 likh dene
  -- se nishan hat jata aur cheez counter par MUFT chali jati (252).
  if p_sale is not null then
    if p_sale <= 0 then
      raise exception 'Sale rate sifar nahi ho sakta -- khali chhoR dein ya asal rate likhein.';
    end if;
    update products set selling_price = p_sale, sale_rate_pending = false where id = p_product_id;
    v_changed := array_append(v_changed, 'sale');
  end if;

  if p_trade is not null then
    if p_trade < 0 then
      raise exception 'Trade rate manfi nahi ho sakta.';
    end if;
    update products set purchase_price = p_trade, trade_rate_pending = false where id = p_product_id;
    v_changed := array_append(v_changed, 'trade');

    -- Indraj usi lamhe, usi kaam mein. Alag karne se wo soorat banti
    -- hai jahan rate charh gaya aur indraj reh gaya.
    insert into product_trade_rate_history
      (product_id, old_rate, old_rate_was_pending, new_rate, source, changed_by)
    values
      (p_product_id,
       -- Nishan laga tha to purana rate "maloom nahi" tha -- wahan
       -- purana adad likhna jhoot hoga.
       case when coalesce(v_trade_pend, false) then null else v_old_trade end,
       coalesce(v_trade_pend, false),
       p_trade, p_source, auth.uid());
  end if;

  -- Thok ka rate NULL bhi rakha ja sakta hai (thok par nahi milta),
  -- magar wo faisla yahan se nahi hota: yahan NULL ka matlab "mat
  -- chheRo" hai. Hatane ke liye product ka apna form hai.
  if p_wholesale is not null then
    if p_wholesale < 0 then
      raise exception 'Thok ka rate manfi nahi ho sakta.';
    end if;
    update products set wholesale_price = p_wholesale where id = p_product_id;
    v_changed := array_append(v_changed, 'wholesale');
  end if;

  if array_length(v_changed, 1) is null then
    return jsonb_build_object('ok', false, 'reason', 'kuch_nahi_bheja');
  end if;

  update products set updated_at = now() where id = p_product_id;

  return jsonb_build_object('ok', true, 'changed', to_jsonb(v_changed));
end;
$$;

revoke all on function fn_set_product_rates(uuid, numeric, numeric, numeric, text) from public;
grant execute on function fn_set_product_rates(uuid, numeric, numeric, numeric, text) to authenticated;

comment on function fn_set_product_rates is
  'Rate charhane ka aam darwaza: rate likhna, nishan hatana aur indraj -- teenon ek sath. Jo NULL bheja jaye wo nahi badalta (253).';
