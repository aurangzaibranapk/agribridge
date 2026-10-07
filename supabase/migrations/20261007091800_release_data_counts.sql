-- Read-only deployment inventory. Service role only; no business rows changed.
create or replace function public.release_data_counts()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t record; n bigint; counts jsonb := '{}'::jsonb;
begin
 for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind in ('r','p') and not c.relispartition order by c.relname loop
  execute format('select count(*) from public.%I',t.relname) into n;
  counts:=counts||jsonb_build_object(t.relname,n);
 end loop;
 return jsonb_build_object('version',1,'capturedAt',now(),'counts',counts);
end $$;
revoke all on function public.release_data_counts() from public,anon,authenticated;
grant execute on function public.release_data_counts() to service_role;
