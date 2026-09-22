-- =====================================================================
-- AgriBridge — Migration 128: POS ki bikri bhi usi qanoon ke neeche
-- =====================================================================
-- 127 mein gyarah jagah se hath ki likhai hatai gayi thi. Wo gyarah
-- TypeScript mein thin. BARHWIN jagah yahan thi -- database ke andar,
-- create_pos_sale ke beech mein -- is liye code mein dhoondne se kabhi
-- nahi mili:
--
--     insert into finance_transactions (...) values (..., 'income', ...);
--     update finance_accounts set current_balance = current_balance + amount;
--
-- Aur yehi sab se ahem jagah hai: POS wo raasta hai jo har roz sab se
-- zyada chalta hai. Har naqad bikri par cash khata DUGNA barhta tha.
--
-- 127 ke baad ye likhai chup chaap ghalat jawab nahi deti -- wo saaf
-- nakaam ho jati hai. Yani is migration ke baghair POS ki har bikri rukk
-- jati. Dono ek sath jani chahiye.
--
-- ---------------------------------------------------------------------
-- Poora function dobara kyun nahi likha
-- ---------------------------------------------------------------------
-- Function 6,000 harf ka hai. Usay yahan dobara likhne ka matlab hota:
-- agar live par us mein koi aur tabdeeli aa chuki ho, to ye migration us
-- ko chup chaap purani halat par le jati.
--
-- Is liye ye migration us ki maujooda soorat parhti hai, us mein se wo
-- EK satr nikalti hai, aur wapas laga deti hai. Satr na mile to migration
-- rukk jati hai -- kyunke us soorat mein ye maloom nahi ke kya hua, aur
-- "shayad theek ho gaya" is jagah par sab se khatarnak jumla hai.
-- =====================================================================

do $$
declare
  v_src text;
  v_patched text;
  v_target text := 'update finance_accounts set current_balance = current_balance + v_batch.amount where id = v_batch.finance_account_id;';
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_pos_sale'
    and pg_get_function_identity_arguments(p.oid) like '%p_payment_lines%';

  if v_src is null then
    raise exception 'create_pos_sale (p_payment_lines wala) mila hi nahi.';
  end if;

  v_patched := replace(
    v_src,
    v_target,
    '-- Yahan pehle balance DOBARA barhaya jata tha. Upar wali qatar daalte hi trigger khud barha deta hai (023, 127).'
  );

  if v_patched = v_src then
    raise exception
      'Wo satr create_pos_sale mein nahi mili. Function pehle hi badal chuka hai -- haath se dekh kar tay karein ke dohri likhai baqi hai ya nahi.';
  end if;

  execute v_patched;
end $$;

-- ---------------------------------------------------------------------
-- Ek purani nakal jo phanda thi
-- ---------------------------------------------------------------------
-- create_pos_sale ke DO roop maujood the: chhe dalail wala (jo chalta
-- hai) aur ek purana paanch dalail wala. Purane mein na payment details
-- thin, na finance ka koi zikr -- yani agar wo kabhi chal jata to POS ka
-- paisa Finance tak pahunchta hi nahi.
--
-- Wo chalta nahi tha kyunke client hamesha chhe dalail bhejta hai. Magar
-- wo ek phanda tha: naye roop mein aakhri daleel ki apni default hai, is
-- liye PAANCH dalail ke sath bulane par Postgres ye faisla hi nahi kar
-- pata ke kaun sa chalaye, aur bikri "function is not unique" keh kar
-- rukk jati.
drop function if exists create_pos_sale(uuid, text, numeric, numeric, jsonb);
