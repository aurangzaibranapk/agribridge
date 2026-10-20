#!/usr/bin/env bash
# Git Bash/Linux: build locally, package only cPanel runtime files.
set -euo pipefail
cd "$(dirname "$0")/.."
git diff --quiet -- src public scripts package.json package-lock.json next.config.js server.js || { echo "App source changes must be committed before release; no files were removed." >&2; exit 1; }
git diff --cached --quiet || { echo "Commit staged changes before release." >&2; exit 1; }
[[ -z "$(git ls-files --others --exclude-standard -- src public scripts)" ]] || { echo "Untracked app files must be saved to Git before release." >&2; exit 1; }
npm ci
node scripts/check-cpanel-env.cjs
node tests/shift-desk-cash.cjs
node tests/shift-summary-embed.cjs
node tests/supplier-bill-math.cjs
node tests/supplier-bill-fields.cjs
node tests/supplier-bill-csv.cjs
node tests/grain-bag-calculation.cjs
node tests/desk-fee.cjs
node tests/finance-statement-filter.cjs
node tests/qa-inventory-procurement.cjs
node tests/hr-self-approval-guards.cjs
node tests/inventory-guards-port.cjs
node tests/pos-return-cash-match.cjs
node tests/safe-form-state.cjs
node tests/my-work-products-count.cjs
node tests/migration-631-phone-key.cjs
node tests/maintenance-mode.cjs
node tests/maintenance-copy-verify.cjs
./node_modules/.bin/tsc --noEmit --incremental
npm run build
[[ -s .next/BUILD_ID ]] || { echo "Production build missing; run npm run build first." >&2; exit 1; }
package_dir=$(mktemp -d)
trap 'rm -rf -- "$package_dir"' EXIT
for item in .next public package.json package-lock.json next.config.js server.js; do
  [[ -e "$item" ]] || { echo "Required runtime file missing: $item" >&2; exit 1; }
  cp -R -- "$item" "$package_dir/"
done
rm -rf -- "$package_dir/.next/cache" "$package_dir/.next/types"
# Apache-level "System Update" safha: wohi file jo server.js maintenance.on par dikhata hai.
# Malik ise ek dafa website ke document root mein ab-maintenance/ ke andar rakhte hain
# (docs/deploy/MAINTENANCE-PAGE.md). verify.mjs dono copies ka barabar hona check karta hai.
mkdir -p "$package_dir/ab-maintenance"
cp public/system-update.html "$package_dir/ab-maintenance/index.html"
# .htaccess snippet aur on/off scripts public folder mein nahi jate (sirf .release mein).
mkdir -p "$package_dir/.release/maintenance"
cp docs/deploy/maintenance/htaccess-snippet.conf scripts/maintenance-on.sh scripts/maintenance-off.sh "$package_dir/.release/maintenance/"
rm -f -- "$package_dir/.next/trace"
mkdir -p "$package_dir/.release"
cp scripts/verify-cpanel-runtime.mjs "$package_dir/.release/verify.mjs"
node scripts/create-cpanel-manifest.mjs "$package_dir"
node "$package_dir/.release/verify.mjs" "$package_dir"
archive_path="$(pwd)/agribridge-clean-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$archive_path" -C "$package_dir" .next public package.json package-lock.json next.config.js server.js .release ab-maintenance
cp "$package_dir/.release/manifest.json" ../agribridge-last-release.json
printf 'Clean package: %s\n' "$archive_path"
wc -c < "$archive_path" | awk '{printf "Size: %.2f MB (%d bytes)\n", $1/1000000, $1}'
printf 'Keep server .env, uploads and node_modules. Replace old .next with this .next. Before restart, run: node .release/verify.mjs\n'
