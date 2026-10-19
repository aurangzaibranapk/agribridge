# Mobile workflows (to be installed)

The bot's GitHub token has no `workflow` scope, so it cannot add files under
`.github/workflows/`. Move these two files there (GitHub web UI → Add file, or
a push from an account/token with `workflow` scope):

- `github-workflows/mobile-ci.yml` → `.github/workflows/mobile-ci.yml` (Mobile CI)
- `github-workflows/mobile-release.yml` → `.github/workflows/mobile-release.yml` (Mobile Play Bundle)

Both were checked locally (YAML parses; every step ran on the box with
Flutter 3.47.7 stable).
