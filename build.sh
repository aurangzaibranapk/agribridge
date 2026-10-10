#!/usr/bin/env bash
# Build the reviewed pending web changes in an isolated worktree for cPanel.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
git fetch origin
branch="build/pending-web-$(date +%Y%m%d-%H%M%S)"
dir="../agribridge-release-$(date +%Y%m%d-%H%M%S)"
git worktree add -b "$branch" "$dir" origin/main
if [[ ! -f "$root/.env.local" ]]; then
  echo "Original project mein .env.local nahi mili; build roka gaya." >&2
  exit 1
fi
cp "$root/.env.local" "$dir/.env.local"
cd "$dir"
echo "Isolated release worktree: $PWD"
git cherry-pick e247b1f1fada722b3ecdeeffdeb4ebbe46b7c5ee
git cherry-pick e333f25ab927066f04c26351fe1733cd49a14a02
npm ci
node tests/receipt-classify.cjs
npm run test:grain-drilldown
bash scripts/package-cpanel.sh
archive="$(ls -t agribridge-clean-*.tar.gz | head -1)"
printf '\nUPLOAD FILE: %s/%s\n' "$PWD" "$archive"
ls -lh "$archive"
sha256sum "$archive"
echo "Only upload if every command above succeeded. This package contains web changes, not the draft mobile app."
