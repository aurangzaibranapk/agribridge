-- =====================================================================
-- AgriBridge — Migration 047: Per-Staff Page Permissions
-- =====================================================================
-- Super Admin/Admin always see everything (unrestricted). For every
-- other role, admin can individually choose which sidebar pages that
-- specific person can access - null means "not yet configured" (falls
-- back to seeing nothing until admin sets it up), an array of hrefs
-- means "only these pages".

alter table profiles add column if not exists allowed_pages jsonb;