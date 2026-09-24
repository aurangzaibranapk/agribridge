-- Supplier ke invoice naam aur system ke product naam ka rishtah.
-- Jab ek baar kisi supplier ka "CC PET 350ML 1X12" ko "COCA COLA 350ML" se
-- joda gaya, agli dafa wahi bill aane par match khud ho jayega.
create table if not exists supplier_product_aliases (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references suppliers(id) on delete cascade,
  supplier_code   text,                          -- invoice ka CODE column (e.g. "112400")
  supplier_name   text not null,                 -- invoice ka item naam, normalized (upper, spaces collapsed)
  product_id      uuid not null references products(id) on delete cascade,
  units_per_pack  int,                           -- kitni pieces ek invoice unit mein (e.g. 12 for 1X12)
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_id, supplier_name)
);

create index if not exists idx_spa_supplier_name  on supplier_product_aliases (supplier_id, supplier_name);
create index if not exists idx_spa_supplier_code  on supplier_product_aliases (supplier_id, supplier_code) where supplier_code is not null;
create index if not exists idx_spa_product        on supplier_product_aliases (product_id);

-- Seed: aaj ka Coca-Cola bill (PO-1789820753836) -- 10 lines
-- Supplier aur products dono naam se dhunde jate hain, UUID hardcode nahi hota.
do $$
declare
  v_supplier_id uuid;
begin
  select supplier_id into v_supplier_id
    from purchases where purchase_number = 'PO-1789820753836' limit 1;

  if v_supplier_id is null then
    raise notice 'Seed skipped: purchase PO-1789820753836 not found';
    return;
  end if;

  insert into supplier_product_aliases
    (supplier_id, supplier_code, supplier_name, product_id, units_per_pack)
  select v_supplier_id, a.code, upper(trim(regexp_replace(a.sname,' +',' ','g'))), p.id, a.upack
  from (values
    ('104300', 'CC PET1L 1X6',                   'COKE 1L',             6),
    ('308400', 'SPRITE LEMON MINT PET1L 1',       'SPRITE MINT 1L',      6),
    ('103541', 'COCA-COLA PET 1.5L /6',           'Coke 1.5L',           6),
    ('100130', 'COCA-COLA RB 250 ML',             'COKE 250ML',          24),
    ('306900', 'SPRITE LEMON-MINT RB 250',        'SPRITE MINT 250ML',   24),
    ('309500', 'SPRITE LMN-MINT PET350ML',        'Sprite Mint 350ml',   12),
    ('112400', 'CC PET 350ML 1X12',               'COCA COLA 350ML',     12),
    ('309700', 'SPRITE LEMON PET 350ML 1X',       'SPRITE 350ML',        12),
    ('131400', 'DASANI WATER PET 500ML 1X',       'DASANI 500ML',        12),
    ('306800', 'SPRITE LEMON-MINT PET500M',       'SPRITE MINT 500ML',   12)
  ) as a(code, sname, pname, upack)
  join products p on p.name ilike a.pname and p.is_deleted = false
  limit 20
  on conflict (supplier_id, supplier_name) do nothing;
end;
$$;

-- DASANI naam mein double-space fix (imported as "DASANI  500ML")
update products set name = 'DASANI 500ML'
  where name = 'DASANI  500ML' and is_deleted = false;
