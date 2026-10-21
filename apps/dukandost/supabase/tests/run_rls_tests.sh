#!/usr/bin/env bash
# Usage: PGURL=postgres://postgres:postgres@localhost:5432/postgres ./run_rls_tests.sh
set -euo pipefail
cd "$(dirname "$0")"
P="psql -v ON_ERROR_STOP=1 -q ${PGURL:?set PGURL}"
$P -c "drop schema if exists dukandost cascade"
$P -f auth_shim.sql
for f in ../migrations/*.sql; do $P -f "$f"; done
$P -f rls_test.sql
