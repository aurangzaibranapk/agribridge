-- Future inserts/identity changes only; existing products/data are untouched.
create or replace function ledger_internal.guard_product_master_identity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare identity text; duplicate_id uuid;
begin
 if new.is_deleted then return new; end if;
 identity:=lower(regexp_replace(trim(new.name),'\s+',' ','g'))||'|'||lower(regexp_replace(trim(coalesce(nullif(new.pack_size,''),new.unit,'')),'\s+',' ','g'))||'|'||coalesce(new.company_id::text,'')||'|'||coalesce(new.category_id::text,'')||'|'||coalesce(new.organization_id::text,'');
 perform pg_advisory_xact_lock(hashtextextended('product-master:'||identity,0));
 select p.id into duplicate_id from products p where p.id<>new.id and not p.is_deleted
   and p.organization_id is not distinct from new.organization_id
   and p.company_id is not distinct from new.company_id and p.category_id is not distinct from new.category_id
   and lower(regexp_replace(trim(p.name),'\s+',' ','g'))=lower(regexp_replace(trim(new.name),'\s+',' ','g'))
   and lower(regexp_replace(trim(coalesce(nullif(p.pack_size,''),p.unit,'')),'\s+',' ','g'))=lower(regexp_replace(trim(coalesce(nullif(new.pack_size,''),new.unit,'')),'\s+',' ','g')) limit 1;
 if duplicate_id is not null then raise exception 'Product Master mein ye naam/pack pehle se hai. Existing product link karein; duplicate nahi banaya (%).',duplicate_id; end if;
 return new;
end $$;
revoke all on function ledger_internal.guard_product_master_identity() from public,anon,authenticated;
drop trigger if exists trg_guard_product_master_identity on public.products;
create trigger trg_guard_product_master_identity before insert or update of name,pack_size,unit,company_id,category_id,is_deleted on public.products for each row execute function ledger_internal.guard_product_master_identity();
