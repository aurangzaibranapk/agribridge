const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = (p) => fs.readFileSync(p, "utf8");

const sql = read("supabase/migrations/536_farmers_default_branch_from_user.sql");
// default must prefer the caller's branch/org, with old default as fallback
assert.match(sql, /branch_id\s+set default coalesce\(public\.fn_current_user_branch_id\(\),\s*public\.fn_default_branch_id\(\)\)/);
assert.match(sql, /organization_id\s+set default coalesce\(public\.fn_current_user_organization_id\(\),\s*public\.fn_default_organization_id\(\)\)/);
// additive: must not loosen RLS
assert.doesNotMatch(sql, /drop policy|disable row level security|create policy/i);

// maker-checker: staff add must not self-verify the farmer
const action = read("src/actions/admin-farmers.ts");
const insert = action.slice(action.indexOf('.from("farmers")'), action.indexOf(".select(\"id\")"));
assert.doesNotMatch(insert, /is_verified\s*:/);
assert.match(insert, /registration_source:\s*"STAFF"/);
console.log("farmers-staff-insert-rls: ok");
