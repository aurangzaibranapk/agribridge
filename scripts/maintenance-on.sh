#!/usr/bin/env bash
# Usage on server (cPanel Terminal):  bash maintenance-on.sh /home/USER/public_html
# Turns on BOTH layers: Apache 503 (works even when Node is stopped) and the in-app flag.
set -euo pipefail
DOCROOT="${1:?document root path missing, e.g. /home/USER/public_html}"
APPROOT="${2:-$HOME/domains/agribridge}"
[[ -s "$DOCROOT/ab-maintenance/index.html" ]] || { echo "Missing $DOCROOT/ab-maintenance/index.html" >&2; exit 1; }
date -Iseconds > "$DOCROOT/ab-maintenance/deploy-in-progress.flag"
touch "$APPROOT/maintenance.on"
echo "Maintenance ON. Visitors now get 503 + 'System Update' page."
