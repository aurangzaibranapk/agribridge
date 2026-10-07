# Saved release record counts

This read-only check captures every public base table, including products, stock, customers, purchases, sales, finance, HR and portal records. Counts are returned in one database request. The function is service-role only, with fixed search_path. No business rows are updated or deleted.

Before each update, run from the project directory in Git Bash:

```bash
node scripts/release-data-guard.cjs capture ../release-before-20261007.json
```

After migration/upload, compare with that exact baseline:

```bash
node scripts/release-data-guard.cjs compare ../release-before-20261007.json
```

Choose a fresh filename for each release. Capture refuses to overwrite an existing baseline. Comparisons refuse another database project. Missing tables or lower counts produce STOP and exit code 1; unchanged tables pass, while increases/new tables are listed for review. Timestamped comparison JSON files are saved next to the baseline, outside deployment archives. Existing production .env.local must supply the service role key; never expose it to the browser/chat.

Keep staff activity paused during the before/after window for a reliable comparison. These snapshots are inventories, not backups. Counts cannot detect replaced rows, modified values, missing Storage objects or broken permissions/features. Continue verified database/Storage backups, file-hash deployment verification and workflow regression tests. This CLI must be run explicitly; it does not automatically block cPanel restart.
