-- NEEDS OWNER APPROVAL
-- Read-only. Do not run the commented UPDATE.
-- SHIFT-26-00020 has been open since 13 Oct 2026. Closing it from SQL
-- without a counted cash figure would invent a journal. Owner must count
-- the drawer, then close the shift from the POS screen (which now claims
-- status='open' and posts one custody journal).

select id, shift_number, status, opened_at, closed_at, opening_cash, counted_cash, expected_cash, difference, staff_id
from public.pos_shifts
where shift_number = 'SHIFT-26-00020';

-- PROPOSED (do not run):
-- After the owner counts cash on the counter, use Close Shift in the app.
-- Do not set status='closed' here. A SQL close with a guessed counted_cash
-- would post the wrong custody journal.
