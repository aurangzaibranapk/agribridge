-- 725 rollback: expire batch phir se seedhi rok, purana jumla.
-- Naye tables aur functions hat te hain. staff_auth_codes nahi cherta.

update public.feature_help
   set purpose = replace(
         purpose,
         ' Expire batch stock mein show ho sakti hai, physically side-line hoti hai, aur bikri se nuqsan ho sakta hai. Sale ke liye wahi admin code chahiye jo POS wapsi par lagta hai.',
         ''
       ),
       how_steps = array_remove(how_steps, 'Expire batch par admin ka code likhein — wahi code jo wapsi par lagta hai.'),
       mistakes = array_remove(mistakes, 'Expire batch bina code bechna.')
 where feature_key = 'pos';

drop function if exists public.fn_pos_sale_with_expired_code(
  jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text, text, text
);

drop trigger if exists trg_guard_expired_batch_sale on public.stock_batches;

create or replace function public.fn_guard_expired_batch_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.remaining_quantity is not null
     and old.remaining_quantity is not null
     and new.remaining_quantity < old.remaining_quantity
     and old.expiry_date is not null
     and old.expiry_date < (timezone('Asia/Karachi', now()))::date
     and current_setting('agribridge.allow_expired_out', true) is distinct from 'on' then
    raise exception 'Expire batch ki bikri band hai (batch %).', old.batch_number;
  end if;
  return new;
end $$;

create trigger trg_guard_expired_batch_sale
  before update on public.stock_batches
  for each row execute function public.fn_guard_expired_batch_sale();

drop table if exists public.pos_expired_sale_overrides;
drop table if exists public.pos_expired_sale_code_attempts;
drop function if exists private.fn_pos_expired_batch_numbers(jsonb, uuid);
drop function if exists private.fn_match_staff_auth_code(text, uuid);
drop function if exists public.fn_expired_batch_sale_block_message(text);
