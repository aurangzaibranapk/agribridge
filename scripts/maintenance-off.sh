#!/usr/bin/env bash
# Usage: bash maintenance-off.sh /home/USER/public_html
# Run only AFTER: verify.mjs says VERIFIED, app restarted, and you checked the site yourself.
set -euo pipefail
DOCROOT="${1:?document root path missing}"
APPROOT="${2:-$HOME/domains/agribridge}"
rm -f "$DOCROOT/ab-maintenance/deploy-in-progress.flag" "$APPROOT/maintenance.on"
code=$(curl -s -o /dev/null -w '%{http_code}' "https://alranatraders.pk/?__ab_up=$(date +%s)" || true)
echo "Maintenance OFF. Home page now answers HTTP $code (expect 200/307)."
