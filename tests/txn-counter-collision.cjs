const assert = require('node:assert/strict');
const sql = require('node:fs').readFileSync('supabase/migrations/540_txn_counter_collision_safe.sql', 'utf8');
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.next_txn_number\(p_year int\)/);
assert.match(sql, /ON CONFLICT \(year\) DO UPDATE/, 'counter row must be locked');
assert.match(sql, /max\(substring\(entry_number/, 'must look at real max entry_number');
assert.match(sql, /greatest\(v_next, v_max\) \+ 1/, 'next must exceed both counter and max');
assert.match(sql, /UPDATE public\.journal_entry_counters c\s+SET last_number = greatest/, 'one-time resync');
// simulate logic
const next = (counter, max) => Math.max(counter, max) + 1;
assert.equal(next(1214, 1219), 1220);
assert.equal(next(1300, 1219), 1301);
assert.equal(next(0, 0), 1);
console.log('PASS: txn counter collision-safe (counter behind max -> skips ahead)');
