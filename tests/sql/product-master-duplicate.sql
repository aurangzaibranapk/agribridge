begin;
do $$
declare p jsonb; ref text:=gen_random_uuid()::text; pid uuid:=gen_random_uuid(); before_count integer;
begin
 select to_jsonb(x) into p from products x where not is_deleted limit 1;
 if p is null then raise exception 'Product fixture required'; end if;
 p:=p||jsonb_build_object('id',pid,'name','Rollback duplicate '||ref,'product_code','TEST-'||left(ref,12),'barcode',null);
 insert into products select (jsonb_populate_record(null::products,p)).*;
 select count(*) into before_count from products;
 begin
   insert into products select (jsonb_populate_record(null::products,p||jsonb_build_object('id',gen_random_uuid(),'name','  ROLLBACK  duplicate '||ref||'  ','product_code','TEST2-'||left(ref,12)))).*;
   raise exception 'Duplicate product accepted';
 exception when others then
   if sqlerrm='Duplicate product accepted' or sqlerrm not like 'Product Master mein%' then raise; end if;
 end;
 if (select count(*) from products)<>before_count then raise exception 'Duplicate record persisted'; end if;
end $$;
set constraints all immediate;
rollback;
