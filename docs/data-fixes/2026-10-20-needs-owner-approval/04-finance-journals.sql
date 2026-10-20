-- NEEDS OWNER APPROVAL
-- Read-only. These are finance-module journals, not POS.
-- TXN-26-000008 and TXN-26-000009 (4 Sep) each net -11,280.
-- TXN-26-000021 and TXN-26-000025 (5 Sep) each net +11,280.
-- A reversal is a new journal, not an edit of the old lines.

select e.id, e.entry_number, e.entry_date, e.source_module, e.description,
       round(sum(l.debit), 2) as debit,
       round(sum(l.credit), 2) as credit,
       round(sum(l.debit - l.credit), 2) as net
from public.journal_entries e
join public.journal_lines l on l.entry_id = e.id
where e.entry_number in ('TXN-26-000008', 'TXN-26-000009', 'TXN-26-000021', 'TXN-26-000025')
group by e.id, e.entry_number, e.entry_date, e.source_module, e.description
order by e.entry_date, e.entry_number;

select e.entry_number, l.account_code, l.debit, l.credit, l.memo, l.party_type, l.party_id
from public.journal_entries e
join public.journal_lines l on l.entry_id = e.id
where e.entry_number in ('TXN-26-000008', 'TXN-26-000009', 'TXN-26-000021', 'TXN-26-000025')
order by e.entry_number, l.line_order;

-- PROPOSED (do not run):
-- If 000008 and 000009 are the same mistaken pair, and 000021 / 000025
-- already put +11,280 back, the owner must say which pair is the keeper.
-- Then post one reversing journal per leftover entry through post_journal_atomic
-- (source_module finance_reversal), swapping debit and credit.
-- Do not UPDATE journal_lines in place.
