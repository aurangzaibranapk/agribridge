#!/usr/bin/env bash
# Throwaway-cluster test for docs/proposals/revoke_anon_trigger_functions_20261019.sql
# Never connects to Supabase. Proves: backup rows written, anon loses EXECUTE,
# triggers still fire for anon writers, rollback restores EXECUTE.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/docs/proposals/revoke_anon_trigger_functions_20261019.sql"
BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DIR="$(mktemp -d)"; PORT="${PORT:-54391}"
trap '"$BIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
P=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt)
FNS=$(grep -oE "'public\.[a-z0-9_]+\(\)'" "$SQL" | sort -u | tr -d "'" )
{
  echo "create role anon; create role authenticated; create role service_role;"
  echo "create table public.t(id int, n int default 0); grant insert, select on public.t to anon;"
  for f in $FNS; do
    name=${f#public.}; name=${name%()}
    echo "create function public.$name() returns trigger language plpgsql security definer as \$\$ begin new.n := new.n + 1; return new; end \$\$;"
    echo "grant execute on function public.$name() to anon, authenticated, service_role;"
    echo "create trigger trg_$name before insert on public.t for each row execute function public.$name();"
  done
} | "${P[@]}"
N=$(echo "$FNS" | wc -l)
"${P[@]}" -f "$SQL" >/dev/null
[ "$("${P[@]}" -c "select count(*) from backups.fn_acl_pre_trigger_revoke_20261019 where acl like '%anon=X%'")" = "$N" ] || { echo "FAIL backup"; exit 1; }
[ "$("${P[@]}" -c "select count(*) from backups.fn_acl_pre_trigger_revoke_20261019 where has_function_privilege('anon', fn::regprocedure,'EXECUTE')")" = 0 ] || { echo "FAIL anon still exec"; exit 1; }
[ "$("${P[@]}" -c "select count(*) from backups.fn_acl_pre_trigger_revoke_20261019 where has_function_privilege('authenticated', fn::regprocedure,'EXECUTE') and has_function_privilege('service_role', fn::regprocedure,'EXECUTE')")" = "$N" ] || { echo "FAIL auth lost exec"; exit 1; }
"${P[@]}" -c "set role anon; insert into public.t(id) values (1);"
[ "$("${P[@]}" -c "select n from public.t where id=1")" = "$N" ] || { echo "FAIL triggers did not all fire for anon"; exit 1; }
# re-run is safe (idempotent)
"${P[@]}" -f "$SQL" >/dev/null
# rollback block
sed -n '/^-- ROLLBACK/,$p' "$SQL" | grep -E '^-- (begin|do|declare|  |end|commit)' | sed 's/^-- //' | "${P[@]}"
[ "$("${P[@]}" -c "select count(*) from backups.fn_acl_pre_trigger_revoke_20261019 where has_function_privilege('anon', fn::regprocedure,'EXECUTE')")" = "$N" ] || { echo "FAIL rollback"; exit 1; }
echo "revoke-anon-trigger-proposal: ok ($N trigger functions; backup, revoke, trigger-fires, idempotent, rollback)"
