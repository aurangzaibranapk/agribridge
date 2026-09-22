-- =====================================================================
-- AgriBridge — ek database ki naql doosre par utaarne ka auzaar
-- =====================================================================
-- Ye file SOURCE (live) database par chalti hai. Ye kuch banati ya
-- badalti nahi -- sirf teen functions banati hai jo maujooda database ko
-- SQL text ki shakal mein wapas dete hain.
--
-- Kyun zaroorat paRi: supabase/migrations/ se poora database nahi banta.
-- 55 tables sirf live mein hain, kisi file mein nahi (tafseel:
-- supabase/tools/README.md). Is liye testing project migrations chala kar
-- nahi, live ki naql utaar kar banaya gaya.
--
-- Kaam khatam hone par teenon functions hata dein:
--   drop function if exists public.__ab_dump_ddl(text);
--   drop function if exists public.__ab_dump_ddl_base(text);
--   drop function if exists public.__ab_trigger_ddl();
--   drop function if exists public.__ab_dump_data(text);
--   drop function if exists public.__ab_row_fingerprint(text);
-- =====================================================================

-- Token badal lein har baar. Iske baghair ye functions kuch nahi dete.
-- (teenon functions mein ek hi token likha hona chahiye)

-- ---------------------------------------------------------------------
-- 1. Triggers ka hissa alag rakha gaya hai: auth/storage schema ke
--    triggers target par pehle se maujood hote hain, is liye un ke aage
--    "drop trigger if exists" lagana paRta hai.
-- ---------------------------------------------------------------------
create or replace function public.__ab_trigger_ddl() returns text
language sql stable as $f$
  select coalesce(string_agg(
    case when n.nspname <> 'public'
      then 'drop trigger if exists ' || quote_ident(t.tgname) || ' on '
           || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || E';\n'
      else '' end
    || pg_get_triggerdef(t.oid) || ';', E'\n' order by t.oid), '')
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','auth','storage')
    and not t.tgisinternal
    and not exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e');
$f$;

-- ---------------------------------------------------------------------
-- 2. Poora schema. Tarteeb ahem hai: functions tables se pehle (kyunki
--    kuch columns ka default ek function hai), constraints tables ke
--    baad, foreign keys sab se aakhir mein.
-- ---------------------------------------------------------------------
create or replace function public.__ab_dump_ddl_base(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $dump$
declare
  v text := '';
begin
  if p_token is distinct from 'ab-9f3c1e7a-copy-schema-2026' then
    raise exception 'not allowed';
  end if;

  -- function bodies ki jaanch band: functions un tables ka zikr karte hain
  -- jo abhi bani hi nahi.
  v := v || E'set check_function_bodies = off;\n\n';

  -- extensions
  v := v || coalesce((
    select string_agg(format('create extension if not exists %I with schema %I;', e.extname, n.nspname), E'\n')
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname not in ('plpgsql','supabase_vault','pg_stat_statements','pg_graphql','pgsodium','pg_net','pgjwt')
  ), '') || E'\n\n';

  -- enum types
  v := v || coalesce((
    select string_agg(
      'create type public.' || quote_ident(t.typname) || ' as enum (' ||
      (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)
         from pg_enum e where e.enumtypid = t.oid) || ');',
      E'\n' order by t.oid)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  ), '') || E'\n\n';

  -- functions
  v := v || coalesce((
    select string_agg(pg_get_functiondef(p.oid) || ';', E'\n' order by p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f','p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ), '') || E'\n\n';

  -- tables (sirf columns; constraints alag se neeche)
  v := v || coalesce((
    select string_agg(
      'create table public.' || quote_ident(c.relname) || E' (\n  ' ||
      (select string_agg(
          quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
          || case when a.attidentity <> '' then ' generated '
                    || case a.attidentity when 'a' then 'always' else 'by default' end
                    || ' as identity' else '' end
          || case when a.attgenerated <> '' then ' generated always as (' || pg_get_expr(d.adbin, d.adrelid) || ') stored'
                  when d.adbin is not null then ' default ' || pg_get_expr(d.adbin, d.adrelid)
                  else '' end
          || case when a.attnotnull and a.attidentity = '' and a.attgenerated = '' then ' not null' else '' end
        , E',\n  ' order by a.attnum)
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
      || E'\n);', E'\n' order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ), '') || E'\n\n';

  -- constraints: pehle primary/unique/exclude, phir check, sab se aakhir
  -- mein foreign key (tab tak saari tables ban chuki hoti hain)
  v := v || coalesce((
    select string_agg(
      'alter table only public.' || quote_ident(c.relname)
      || ' add constraint ' || quote_ident(con.conname) || ' '
      || pg_get_constraintdef(con.oid) || ';',
      E'\n' order by case con.contype when 'p' then 1 when 'u' then 2 when 'x' then 3
                                      when 'c' then 4 else 5 end,
                     c.relname, con.conname)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and con.contype in ('p','u','x','c','f')
  ), '') || E'\n\n';

  -- wo indexes jo kisi constraint ke sath nahi bane
  v := v || coalesce((
    select string_agg(i.indexdef || ';', E'\n' order by i.tablename, i.indexname)
    from pg_indexes i
    where i.schemaname = 'public'
      and not exists (
        select 1 from pg_constraint con
        join pg_class ic on ic.oid = con.conindid
        join pg_namespace icn on icn.oid = ic.relnamespace
        where icn.nspname = 'public' and ic.relname = i.indexname)
  ), '') || E'\n\n';

  -- views, banane ki tarteeb mein (ek view sirf apne se pehle bane view
  -- par tikka ho sakta hai, is liye oid ki tarteeb kaafi hai)
  v := v || coalesce((
    select string_agg('create or replace view public.' || quote_ident(c.relname)
                      || ' as ' || pg_get_viewdef(c.oid, true), E'\n' order by c.oid)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  ), '') || E'\n\n';

  -- view ki settings (jaise security_invoker)
  v := v || coalesce((
    select string_agg('alter view public.' || quote_ident(c.relname)
                      || ' set (' || array_to_string(c.reloptions, ', ') || ');',
                      E'\n' order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v' and c.reloptions is not null
  ), '') || E'\n\n';

  -- triggers (public + auth/storage par lage hue app ke triggers)
  v := v || public.__ab_trigger_ddl() || E'\n\n';

  -- row level security
  v := v || coalesce((
    select string_agg('alter table public.' || quote_ident(c.relname) || ' enable row level security;'
      || case when c.relforcerowsecurity
              then E'\nalter table public.' || quote_ident(c.relname) || ' force row level security;'
              else '' end,
      E'\n' order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  ), '') || E'\n\n';

  -- policies (public + storage)
  v := v || coalesce((
    select string_agg(
      'create policy ' || quote_ident(pol.polname) || ' on '
      || quote_ident(n.nspname) || '.' || quote_ident(c.relname)
      || ' as ' || case when pol.polpermissive then 'permissive' else 'restrictive' end
      || ' for ' || case pol.polcmd when 'r' then 'select' when 'a' then 'insert'
                                    when 'w' then 'update' when 'd' then 'delete'
                                    else 'all' end
      || case when pol.polroles = '{0}'::oid[] then ' to public'
              else ' to ' || (select string_agg(quote_ident(r.rolname), ', ' order by r.rolname)
                                from pg_roles r where r.oid = any(pol.polroles)) end
      || coalesce(' using (' || pg_get_expr(pol.polqual, pol.polrelid) || ')', '')
      || coalesce(' with check (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')', '')
      || ';',
      E'\n' order by n.nspname, c.relname, pol.polname)
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','storage')
  ), '') || E'\n\n';

  -- table grants
  v := v || coalesce((
    select string_agg(format('grant %s on public.%I to %I;', g.privilege_type, g.table_name, g.grantee),
                      E'\n' order by g.table_name, g.grantee, g.privilege_type)
    from information_schema.role_table_grants g
    where g.table_schema = 'public' and g.grantee in ('anon','authenticated','service_role')
  ), '') || E'\n\n';

  -- storage buckets (sirf buckets, un ki files nahi)
  v := v || coalesce((
    select string_agg(
      format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %s) on conflict (id) do nothing;',
             b.id, b.name, b.public,
             coalesce(b.file_size_limit::text, 'null'),
             case when b.allowed_mime_types is null then 'null'
                  else quote_literal(b.allowed_mime_types::text) || '::text[]' end),
      E'\n' order by b.id)
    from storage.buckets b
  ), '') || E'\n';

  return v;
end
$dump$;

-- Target par storage ki purani policies pehle hata di jati hain, warna
-- "already exists" par poori naql ruk jati hai.
create or replace function public.__ab_dump_ddl(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $x$
begin
  if p_token is distinct from 'ab-9f3c1e7a-copy-schema-2026' then
    raise exception 'not allowed';
  end if;

  return E'do $clr$ declare r record; begin for r in select policyname, tablename from pg_policies where schemaname = ''storage'' loop execute format(''drop policy if exists %I on storage.%I'', r.policyname, r.tablename); end loop; end $clr$;\n\n'
         || public.__ab_dump_ddl_base(p_token);
end
$x$;

-- ---------------------------------------------------------------------
-- 3. Data. session_replication_role = replica se foreign keys aur app ke
--    triggers is naql ke doraan chup rehte hain -- warna tarteeb ka
--    masla banta aur balance wale triggers dobara chal kar hisaab kharab
--    kar dete.
-- ---------------------------------------------------------------------
create or replace function public.__ab_dump_data(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $d$
declare
  r record;
  v text := '';
  j text;
  cols text;
begin
  if p_token is distinct from 'ab-9f3c1e7a-copy-schema-2026' then
    raise exception 'not allowed';
  end if;

  v := E'set session_replication_role = replica;\n';

  for r in
    select c.oid, n.nspname, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and ( (n.nspname = 'auth' and c.relname in ('users','identities'))
            or n.nspname = 'public' )
    order by case when n.nspname = 'auth' then 0 else 1 end,
             case when c.relname = 'users' then 0 else 1 end,
             c.relname
  loop
    -- generated columns chhoR dein: un mein daala nahi ja sakta
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
    from pg_attribute a
    where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';

    execute format('select coalesce(json_agg(t)::text, ''[]'') from (select * from %I.%I) t',
                   r.nspname, r.relname) into j;

    if j is not null and j <> '[]' then
      v := v || format('insert into %I.%I (%s) select %s from json_populate_recordset(null::%I.%I, %L);',
                       r.nspname, r.relname, cols, cols, r.nspname, r.relname, j) || E'\n';
    end if;
  end loop;

  v := v || E'set session_replication_role = origin;\n';
  return v;
end
$d$;

-- ---------------------------------------------------------------------
-- 4. Milaan: dono taraf chala kar md5 barabar hona chahiye.
-- ---------------------------------------------------------------------
create or replace function public.__ab_row_fingerprint(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $f$
declare r record; v text := ''; n bigint;
begin
  if p_token is distinct from 'ab-9f3c1e7a-copy-schema-2026' then
    raise exception 'not allowed';
  end if;

  for r in
    select n.nspname, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users','identities')))
    order by n.nspname, c.relname
  loop
    execute format('select count(*) from %I.%I', r.nspname, r.relname) into n;
    if n > 0 then
      v := v || r.nspname || '.' || r.relname || '=' || n || E'\n';
    end if;
  end loop;

  return v;
end
$f$;

revoke all on function public.__ab_dump_ddl(text)       from public;
revoke all on function public.__ab_dump_ddl_base(text)  from public;
revoke all on function public.__ab_dump_data(text)      from public;
revoke all on function public.__ab_row_fingerprint(text) from public;
grant execute on function public.__ab_dump_ddl(text)        to service_role;
grant execute on function public.__ab_dump_data(text)       to service_role;
grant execute on function public.__ab_row_fingerprint(text) to service_role;
