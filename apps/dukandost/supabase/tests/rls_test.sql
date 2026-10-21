-- RLS tests: two shops, two users; each must see only its own rows.
\set ON_ERROR_STOP on
reset role;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into dukandost.shops(id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','Shop A');
insert into dukandost.items(id,shop_id,name) values (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','A item');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into dukandost.shops(id,name) values ('bbbbbbbb-0000-0000-0000-000000000001','Shop B');
insert into dukandost.items(id,shop_id,name) values (gen_random_uuid(),'bbbbbbbb-0000-0000-0000-000000000001','B item');

do $$ declare n int; begin
  select count(*) into n from dukandost.items; if n <> 1 then raise exception 'B sees % items', n; end if;
  select count(*) into n from dukandost.shops; if n <> 1 then raise exception 'B sees % shops', n; end if;
  begin
    insert into dukandost.items(id,shop_id,name) values (gen_random_uuid(),'aaaaaaaa-0000-0000-0000-000000000001','hack');
    raise exception 'cross-tenant insert allowed';
  exception when insufficient_privilege then null; end;
  update dukandost.items set name='x' where shop_id='aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'cross-tenant update hit % rows', n; end if;
  begin
    update dukandost.shops set plan='pro' where id='bbbbbbbb-0000-0000-0000-000000000001';
    raise exception 'client could change plan';
  exception when insufficient_privilege then null; end;
  begin
    insert into dukandost.shops(name, owner_id) values ('spoof','00000000-0000-0000-0000-00000000000a');
    raise exception 'spoofed owner allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from dukandost.items; raise exception 'delete allowed';
  exception when insufficient_privilege then null; end;
  if dukandost.effective_plan('bbbbbbbb-0000-0000-0000-000000000001') <> 'trial' then raise exception 'plan not trial'; end if;
  if dukandost.effective_plan('aaaaaaaa-0000-0000-0000-000000000001') is not null then raise exception 'plan leak'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  perform 1 from dukandost.items; raise exception 'anon can read';
exception when insufficient_privilege then null; end $$;
reset role;
select 'RLS TESTS PASSED';
