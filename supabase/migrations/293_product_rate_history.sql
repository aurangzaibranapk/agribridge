-- =====================================================================
-- AgriBridge — Migration 293: Cheez ka MAUJOODA rate, aur rate ki tareekh
-- =====================================================================
-- Malik ka usool (4 September):
--
--   "Agar aaj same product Rs100 purchase rate par aaya aur kal Rs110
--    par, to system ko current/latest trade or purchase rate Rs110
--    update kar dena chahiye. Lekin purane purchase records ko Rs110
--    mein overwrite nahi karna chahiye."
--
--   Historical Purchase Rate = immutable
--   Current Product Trade/Reference Rate = latest approved purchase rate
--
-- DO ALAG CHEEZEIN, aur inhen ek samajh lena is nizam ki sab se mehngi
-- ghalti hoti:
--
--   * PURANA BILL / GRN / batch ka rate -- wo us din ki SACHCHAI hai.
--     Us par Rs110 likh dena us din ka hisaab jhoota kar dena hai:
--     supplier ko us bill par Rs100 hi diya gaya tha, aur us maal ka
--     munafa Rs100 par ginna hi theek hai. Ye kabhi nahi badalta.
--
--   * CHEEZ KA MAUJOODA HAWALA RATE -- "aaj ye cheez kitne ki aati
--     hai". Ye hamesha aakhri manzoor shuda kharid ka rate hota hai.
--
-- Yahan naya rate ka khana NAHI banaya gaya. `products.purchase_price`
-- pehle se yehi kaam kar raha hai; us ke saath sirf ye likha ja raha hai
-- ke wo rate KAHAN se aaya (kaunsi purchase, kaunsa supplier, kab). Ek
-- hi baat ke do khane bana dene se kisi din wo do alag adad kehne lagte
-- hain, aur phir koi nahi bata sakta ke sahi kaunsa hai.
--
-- TEEN HISSE:
--   1. Rate kahan se aaya (products par teen khane)
--   2. Rate ki tareekh -- sirf barhne wali fehrist (product_rate_history)
--   3. Khabar -- manager ko poori tafseel, counter wale ko saada baat
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Maujooda rate kahan se aaya
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists latest_purchase_rate_at timestamptz,
  add column if not exists latest_purchase_id uuid references public.purchases(id) on delete set null,
  add column if not exists latest_supplier_id uuid references public.suppliers(id) on delete set null;

comment on column public.products.purchase_price is
  'Maujooda hawala rate: aakhri MANZOOR SHUDA kharid ka rate. Purane bill/GRN/batch ke rate is se alag hain aur kabhi nahi badalte (293).';
comment on column public.products.latest_purchase_rate_at is 'Ye rate kab laga (293).';
comment on column public.products.latest_purchase_id is 'Kis purchase se aaya (293).';
comment on column public.products.latest_supplier_id is 'Kis supplier se aaya (293).';

-- ---------------------------------------------------------------------
-- 2. Rate badalne ki hadd -- kab khabar bhejni hai
-- ---------------------------------------------------------------------
-- Har paisay ki harkat par khabar bhejna khabar ko bekaar kar deta hai:
-- log parhna chhoR dete hain, aur us ke baad ASAL khabar bhi usi Dher
-- mein dab jati hai. Is liye do haddein: is se kam par kuch nahi hota,
-- aur is se ooper "baRi tabdeeli" ka nishaan lagta hai.
create table if not exists public.rate_alert_config (
  id smallint primary key default 1 check (id = 1),
  -- Is se chhoti tabdeeli gol karne ka farq samjhi jati hai.
  tolerance_pct numeric not null default 0.5,
  tolerance_amount numeric not null default 1,
  -- Is se baRi tabdeeli par khabar zor se jati hai.
  big_change_pct numeric not null default 5,
  big_change_amount numeric not null default 500,
  updated_at timestamptz not null default now()
);

insert into public.rate_alert_config (id) values (1) on conflict (id) do nothing;

alter table public.rate_alert_config enable row level security;

drop policy if exists rate_alert_config_read on public.rate_alert_config;
create policy rate_alert_config_read on public.rate_alert_config
  for select to authenticated using (true);

drop policy if exists rate_alert_config_write on public.rate_alert_config;
create policy rate_alert_config_write on public.rate_alert_config
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
                   and p.role::text in ('owner','super_admin','admin')));

-- ---------------------------------------------------------------------
-- 3. Rate ki tareekh -- sirf barhti hai, kabhi badalti nahi
-- ---------------------------------------------------------------------
create table if not exists public.product_rate_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  -- 'purchase' = kharid ka rate, 'selling' = bikri ka rate. Ek hi
  -- fehrist mein dono, kyunke sawal hamesha ek sath poocha jata hai:
  -- "lagat barhi thi ya qeemat?"
  rate_kind text not null check (rate_kind in ('purchase','selling')),
  -- Pehli dafa rate lagne par purana NULL rehta hai -- sifar nahi.
  -- Sifar ka matlab hota "pehle ye muft aati thi".
  old_rate numeric,
  new_rate numeric not null,
  diff_amount numeric,
  diff_pct numeric,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  batch_id uuid references public.stock_batches(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  source text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists ix_rate_history_product on public.product_rate_history (product_id, changed_at desc);

alter table public.product_rate_history enable row level security;

-- Parhna un ke liye jo rate ka kaam karte hain. Counter wale ko lagat ki
-- fehrist nahi chahiye -- us ka kaam bikri ka rate hai, aur wo cheez par
-- likha hota hai.
drop policy if exists rate_history_read on public.product_rate_history;
create policy rate_history_read on public.product_rate_history
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
        and p.role::text in ('owner','super_admin','admin','manager','procurement','warehouse','finance')
    )
  );

-- Likhna sirf nizam ka apna kaam hai (neeche wala trigger). Haath se
-- qatar daalne ya badalne ka koi raasta nahi -- warna tareekh wo cheez
-- nahi rehti jis par bharosa kiya ja sake.
revoke insert, update, delete on public.product_rate_history from authenticated;

-- ---------------------------------------------------------------------
-- 4. Rate badle to: tareekh likho, aur sahi bande ko khabar do
-- ---------------------------------------------------------------------
-- Ye kaam har us jagah se hona chahiye jahan rate manzoor hota hai --
-- maal wusool hone par, bill se rate charhne par, product setup par,
-- tajweez manzoor hone par. Agar ye kaam har raaste ka apna hota to koi
-- ek raasta usay bhool jata, aur wo soorat mahinon nazar na aati: rate
-- theek chalta rehta, bas tareekh aur khabar na banti.
--
-- Is liye ye rok CHEEZ par lagi hai, raaste par nahi. Rate jahan se bhi
-- badle, yahan se guzarta hai.
create or replace function public.fn_product_rate_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg          rate_alert_config;
  r              record;
  v_diff         numeric;
  v_pct          numeric;
  v_title        text;
  v_msg          text;
  v_margin       numeric;
  v_bara         boolean;
begin
  select * into v_cfg from rate_alert_config where id = 1;

  -- Dono rate ek hi update mein badal sakte hain (bill se rate charhte
  -- waqt aksar dono badalte hain). Is liye dono par alag alag guzarna
  -- hota hai -- pehla dekh kar laut jane se doosra chup chaap nikal
  -- jata, aur wo soorat mahinon nazar na aati.
  for r in
    select * from (values
      ('purchase'::text, old.purchase_price::numeric, new.purchase_price::numeric),
      ('selling'::text,  old.selling_price::numeric,  new.selling_price::numeric)
    ) as x(kind, old_rate, new_rate)
    where x.new_rate is distinct from x.old_rate
      and x.new_rate is not null
  loop
    -- Sifar ya khali se rate lagna "tabdeeli" nahi, PEHLI DAFA rate
    -- lagna hai. Us par "0 se 110 ho gaya" jaisi khabar bhejna bewaqoofi
    -- hai -- aur faisad ginna mumkin bhi nahi. Purana NULL likha jata
    -- hai, sifar nahi: sifar ka matlab hota "pehle ye muft aati thi".
    if r.old_rate is null or r.old_rate = 0 then
      insert into product_rate_history
        (product_id, rate_kind, old_rate, new_rate, branch_id, source, changed_by)
      values
        (new.id, r.kind, null, r.new_rate, new.branch_id, 'pehli dafa rate laga', auth.uid());
      continue;
    end if;

    v_diff := r.new_rate - r.old_rate;
    v_pct  := round((v_diff / r.old_rate) * 100, 2);

    -- Gol karne jitna farq tabdeeli nahi. Bar bar aane wali khabar ko
    -- log parhna chhoR dete hain -- aur us ke baad asal khabar bhi usi
    -- Dher mein dab jati hai.
    if abs(v_diff) < v_cfg.tolerance_amount and abs(v_pct) < v_cfg.tolerance_pct then
      continue;
    end if;

    insert into product_rate_history
      (product_id, rate_kind, old_rate, new_rate, diff_amount, diff_pct,
       supplier_id, purchase_id, branch_id, source, changed_by)
    values
      (new.id, r.kind, r.old_rate, r.new_rate, v_diff, v_pct,
       new.latest_supplier_id, new.latest_purchase_id, new.branch_id,
       case when r.kind = 'purchase' then 'manzoor shuda kharid' else 'bikri ka rate badla' end,
       auth.uid());

    v_bara := abs(v_diff) >= v_cfg.big_change_amount or abs(v_pct) >= v_cfg.big_change_pct;

    if r.kind = 'purchase' then
      -- ===== Manager ko poori tafseel =====
      -- Lagat barhne ka faisla bikri ke rate par hota hai, aur wo faisla
      -- munafe ka adad dekhe baghair nahi ho sakta. Is liye khabar mein
      -- munafa bhi jata hai -- warna manager ko wo khud ginna parta hai,
      -- aur wo koi nahi ginta.
      v_title := case when v_bara then 'Rate mein baRi tabdeeli — ' else 'Kharid ka rate badla — ' end || new.name;

      if new.selling_price is not null and new.selling_price > 0 then
        v_margin := round(((new.selling_price - r.new_rate) / new.selling_price) * 100, 1);
        v_msg :=
          'Kharid: Rs ' || round(r.old_rate)::text || ' → Rs ' || round(r.new_rate)::text ||
          ' (' || case when v_diff > 0 then '+' else '' end || round(v_diff)::text || ', ' ||
          case when v_pct > 0 then '+' else '' end || v_pct::text || '%). ' ||
          'Bikri ka rate abhi Rs ' || round(new.selling_price)::text ||
          ' — munafa ' || v_margin::text || '%. Bikri ka rate dekh lein.';
      else
        -- Bikri ka rate darj hi nahi: munafa ginna mumkin nahi. Yahan
        -- sifar likh dena "is par kuch nahi bachta" kehna hoga -- jab ke
        -- asal baat ye hai ke rate laga hi nahi.
        v_msg :=
          'Kharid: Rs ' || round(r.old_rate)::text || ' → Rs ' || round(r.new_rate)::text ||
          ' (' || case when v_pct > 0 then '+' else '' end || v_pct::text || '%). ' ||
          'Is cheez ka bikri ka rate abhi darj nahi — munafa nahi gina ja sakta.';
      end if;

      insert into notifications (recipient_user_id, title, message, link_url)
      select distinct p.id, v_title, v_msg, '/admin/products'
      from profiles p
      where p.is_active
        and p.role::text in ('owner','super_admin','admin','manager','procurement','warehouse')
        -- Apne kiye hue kaam ki khabar khud ko nahi. Banda jaanta hai ke
        -- us ne abhi kya kiya; usay dobara batana shor hai.
        and p.id is distinct from auth.uid()
        -- Shaakh ka kaam usi shaakh walon ko; owner/admin ko har soorat.
        and (
          new.branch_id is null
          or p.branch_id is null
          or p.branch_id = new.branch_id
          or p.role::text in ('owner','super_admin','admin')
        );

    else
      -- ===== Counter wale ko saada baat =====
      -- Malik ka kehna: staff confuse na ho. Counter par lagat ka koi
      -- kaam nahi -- wahan ek hi adad chalta hai: aaj ye cheez kitne ki
      -- bikni hai. Lagat is khabar mein jati hi nahi.
      v_title := 'Rate update — ' || new.name;
      v_msg :=
        'Bikri ka rate Rs ' || round(r.old_rate)::text || ' se Rs ' || round(r.new_rate)::text ||
        ' ho gaya hai. POS par naya rate khud lag jayega.';

      insert into notifications (recipient_user_id, title, message, link_url)
      select distinct p.id, v_title, v_msg, '/admin/pos'
      from profiles p
      where p.is_active
        and p.role::text in ('sales_staff','manager')
        and p.id is distinct from auth.uid()
        and (
          new.branch_id is null
          or p.branch_id is null
          or p.branch_id = new.branch_id
        );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_product_rate_changed on public.products;
create trigger trg_product_rate_changed
  after update of purchase_price, selling_price on public.products
  for each row execute function public.fn_product_rate_changed();

notify pgrst, 'reload schema';
