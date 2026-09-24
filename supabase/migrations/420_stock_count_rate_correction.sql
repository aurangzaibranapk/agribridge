-- Ginti ke dauran "Extra Item" se joRi gayi cheezon ka rate kabhi kabhi
-- galat likha jata hai (malik, 15 September: "surfexcel" ka rate Rs 9
-- likha gaya, jab ke asal rate Rs 250+ hai -- staff jaldi mein Quantity
-- aur Rate ke khane ulta bhar gaya). Ye rate seedha Milan (Review) ke
-- journal entry mein chala jata hai (postCount -> Stock Loss/Stock
-- Goods) -- yani ghalat rate ka matlab sirf ghalat number dikhna nahi,
-- asal hisaab kitaab bhi ghalat ban jata hai.
--
-- `fn_stock_count_guard` jaan boojh kar `unit_cost`/`expected_qty` ko
-- kisi bhi seedhi UPDATE se rok deta hai -- taake koi apna farq
-- chhupane ke liye rate na badal sake. Ye rok theek hai aur waisi hi
-- rehni chahiye. Is liye seedha UPDATE ki bajaye, ek nayi, tang
-- SECURITY DEFINER raah banai gayi hai jo:
--   - sirf Owner/Admin/Super Admin chala sakte hain,
--   - sirf jab tak ginti POSTED na ho chuki ho,
--   - wajah (kam az kam 5 huroof) mangwati hai,
--   - audit_logs mein purana/naya rate aur wajah likh deti hai.

create or replace function public.fn_stock_count_guard()
returns trigger
language plpgsql
as $function$
declare
  v_status text;
  v_missing int;
begin
  if tg_op = 'DELETE' then
    raise exception 'Ginti ka record mitaya nahi ja sakta.';
  end if;

  if tg_table_name = 'stock_counts' then
    if old.status = 'posted' then
      raise exception 'Ye ginti mukammal ho chuki hai. Dobara ginna hai to nayi ginti shuru karein.';
    end if;

    if new.warehouse_id is distinct from old.warehouse_id
       or new.started_by is distinct from old.started_by then
      raise exception 'Ginti ka godam ya ginne wala badla nahi ja sakta.';
    end if;

    if new.status = 'posted' then
      select count(*) into v_missing from stock_count_lines
      where count_id = new.id and counted_qty is null;
      if v_missing > 0 then
        raise exception 'Ginti mukammal nahi ho sakti: % cheezen abhi gini nahi gayin.', v_missing;
      end if;

      select count(*) into v_missing from stock_count_lines
      where count_id = new.id
        and coalesce(difference_qty, 0) <> 0
        and (reason is null or length(btrim(reason)) < 5);
      if v_missing > 0 then
        raise exception 'Ginti mukammal nahi ho sakti: % qataron ka farq bina wajah ke hai.', v_missing;
      end if;
    end if;

    return new;
  end if;

  select status into v_status from stock_counts where id = new.count_id;
  if v_status = 'posted' then
    raise exception 'Ye ginti mukammal ho chuki hai, ab qataren badli nahi ja saktin.';
  end if;

  -- Sirf `fn_correct_stock_count_unit_cost()` ke andar se, ek dafa ke
  -- liye, ye rok hatai jati hai -- kisi aam UPDATE se nahi.
  if (new.expected_qty is distinct from old.expected_qty
     or new.unit_cost is distinct from old.unit_cost)
     and coalesce(current_setting('app.stock_count_correction', true), '') <> 'on' then
    raise exception 'System ka mahfooz shuda adad badla nahi ja sakta.';
  end if;

  return new;
end;
$function$;

create or replace function public.fn_correct_stock_count_unit_cost(
  p_line_id uuid,
  p_new_unit_cost numeric,
  p_note text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_role text;
  v_full_name text;
  v_count_id uuid;
  v_status text;
  v_old_cost numeric;
  v_product_name text;
begin
  select role, full_name into v_role, v_full_name from profiles where id = auth.uid();
  if v_role is null or v_role not in ('owner', 'super_admin', 'admin') then
    raise exception 'Ye kaam sirf Owner/Admin kar sakte hain.';
  end if;

  if p_new_unit_cost is null or p_new_unit_cost < 0 then
    raise exception 'Sahi rate likhein.';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Wajah likhein (kam az kam 5 huroof) -- rate kyun theek kiya ja raha hai.';
  end if;

  select scl.count_id, sc.status, scl.unit_cost, p.name
    into v_count_id, v_status, v_old_cost, v_product_name
  from stock_count_lines scl
  join stock_counts sc on sc.id = scl.count_id
  join products p on p.id = scl.product_id
  where scl.id = p_line_id;

  if v_count_id is null then
    raise exception 'Qatar nahi mili.';
  end if;
  if v_status = 'posted' then
    raise exception 'Ye ginti mukammal ho chuki hai, rate ab theek nahi ho sakta.';
  end if;

  perform set_config('app.stock_count_correction', 'on', true);
  update stock_count_lines
    set unit_cost = p_new_unit_cost
    where id = p_line_id;
  perform set_config('app.stock_count_correction', 'off', true);

  insert into audit_logs (actor_id, actor_name, actor_role, action_type, module, record_id, record_label, description)
  values (
    auth.uid(),
    v_full_name,
    v_role,
    'update',
    'stock-count',
    p_line_id::text,
    v_product_name,
    format('Ginti ka rate theek kiya: Rs %s se Rs %s -- %s', v_old_cost, p_new_unit_cost, p_note)
  );
end;
$function$;

grant execute on function public.fn_correct_stock_count_unit_cost(uuid, numeric, text) to authenticated;
