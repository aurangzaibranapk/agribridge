#!/usr/bin/env bash
# Build the cPanel release and apply every pending migration to the LIVE
# Supabase project linked from this checkout. Run only after a verified backup.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

[[ "$(git branch --show-current)" == "main" ]] || {
  echo "ERROR: main branch par nahi hain. Pehle main update karein." >&2
  exit 1
}

git diff --quiet && git diff --cached --quiet || {
  echo "ERROR: tracked local changes maujood hain; release rok di gayi." >&2
  exit 1
}

required_migrations=(
  "supabase/migrations/20261012062918_recovery_payables_and_receipts.sql"
  "supabase/migrations/20261012135000_unified_customer_farmer_khata.sql"
  "supabase/migrations/20261012140500_remove_legacy_farmer_all_access.sql"
)
for migration in "${required_migrations[@]}"; do
  [[ -s "$migration" ]] || {
    echo "ERROR: migration missing: $migration" >&2
    exit 1
  }
done

[[ -f .env.local ]] || {
  echo "ERROR: .env.local nahi mili; Live project pehchana nahi ja sakta." >&2
  exit 1
}

url_line="$(grep -E '^[[:space:]]*(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL)[[:space:]]*=' .env.local | head -n 1 || true)"
live_ref="$(printf '%s' "$url_line" | sed -E 's#.*https://([^.]+)\.supabase\.co.*#\1#')"
[[ "$live_ref" =~ ^[a-z0-9]{15,30}$ ]] || {
  echo "ERROR: .env.local se Supabase project ref nahi mila." >&2
  exit 1
}

# Connected MCP Testing project. Live release must never target it.
if [[ "$live_ref" == "hwaiuwxqldxsoukkfefn" ]]; then
  echo "ERROR: .env.local Testing Supabase ko point kar rahi hai. Live migration roki gayi." >&2
  exit 1
fi

echo "LIVE Supabase project ref: $live_ref"
read -r -p "Backup verify karke LIVE likhein: " confirm_live
[[ "$confirm_live" == "LIVE" ]] || {
  echo "Cancelled: koi database ya build change nahi ki gayi."
  exit 1
}

# Authentication is read-only here. If missing, CLI opens its normal login flow.
npx supabase projects list >/dev/null 2>&1 || npx supabase login
npx supabase link --project-ref "$live_ref"

echo "Step 1/3: tests, type-check, production build aur clean cPanel archive"
bash scripts/package-cpanel.sh

echo "Step 2/3: Live database par pending migrations ka dry-run"
npx supabase migration list
npx supabase db push --dry-run

read -r -p "Upar target aur pending migrations sahi hon to MIGRATE likhein: " confirm_migrate
[[ "$confirm_migrate" == "MIGRATE" ]] || {
  echo "Migration cancelled. Bani hui archive upload NA karein."
  exit 1
}

echo "Step 3/3: pending migrations Live database par apply ho rahi hain"
npx supabase db push
npx supabase migration list

archive="$(ls -t agribridge-clean-*.tar.gz | head -n 1)"
echo
echo "SUCCESS — migrations aur build dono complete."
echo "UPLOAD FILE: $root/$archive"
ls -lh "$archive"
sha256sum "$archive"
