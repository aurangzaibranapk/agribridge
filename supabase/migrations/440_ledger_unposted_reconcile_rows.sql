-- v_ledger_unposted ke jhoote alarm (19 September ka finance review).
--
-- Cash Book mein kuch qatarein JAAN BOOJH KAR ek-tarfa hain: wo
-- "Ledger se milan" / "Ledger Reconciliation" ki durustiyan hain jo
-- Cash Book ko ledger ke barabar laane ke liye likhi gayi thin (6-14
-- September). Un ka ledger mein koi apna rukh hai hi nahi -- wohi to
-- maqsad tha. View unhe hamesha "ledger tak nahi pahuncha" dikhata
-- raha, jo parhne wale ko jhoota masla dikhata hai.
--
-- Sirf finance_transactions wala hissa badla hai: in do categories ko
-- chhoR do. Baqi sab jaanchén waise ki waisi.

create or replace view v_ledger_unposted as
 SELECT 'finance_transactions'::text AS source_table,
    ft.id AS row_id,
    ft.amount,
    ft.created_at,
    ft.transaction_type::text AS kind,
    COALESCE(ft.notes, ft.category, 'Cash / bank'::text) AS detail
   FROM finance_transactions ft
  WHERE COALESCE(ft.category, ''::text) <> ALL (ARRAY['Ledger se milan'::text, 'Ledger Reconciliation'::text])
    AND NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'finance_transactions'::text AND s.source_row_id = ft.id))
UNION ALL
 SELECT 'farmer_credit_ledger'::text AS source_table,
    f.id AS row_id,
    f.amount,
    f.created_at,
    (f.source_type::text || ' / '::text) || f.ledger_type::text AS kind,
    COALESCE(f.notes, 'Kisan ka khata'::text) AS detail
   FROM farmer_credit_ledger f
  WHERE NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'farmer_credit_ledger'::text AND s.source_row_id = f.id))
UNION ALL
 SELECT 'branch_credit_transactions'::text AS source_table,
    b.id AS row_id,
    b.amount,
    b.created_at,
    b.transaction_type AS kind,
    COALESCE(b.notes, 'Branch ka khata'::text) AS detail
   FROM branch_credit_transactions b
  WHERE NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'branch_credit_transactions'::text AND s.source_row_id = b.id))
UNION ALL
 SELECT 'staff_credit_ledger'::text AS source_table,
    st.id AS row_id,
    st.amount,
    st.created_at,
    (st.source_type || ' / '::text) || st.ledger_type AS kind,
    COALESCE(st.notes, 'Staff ka khata'::text) AS detail
   FROM staff_credit_ledger st
  WHERE NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'staff_credit_ledger'::text AND s.source_row_id = st.id))
UNION ALL
 SELECT 'customer_ledger'::text AS source_table,
    c.id AS row_id,
    GREATEST(c.debit, c.credit) AS amount,
    c.created_at,
    c.entry_type::text AS kind,
    COALESCE(c.notes, 'Customer ka khata'::text) AS detail
   FROM customer_ledger c
  WHERE NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'customer_ledger'::text AND s.source_row_id = c.id))
UNION ALL
 SELECT 'wallet_transactions'::text AS source_table,
    w.id AS row_id,
    w.amount,
    w.created_at,
    (w.type::text || ' / '::text) || w.direction::text AS kind,
    COALESCE(w.notes, 'Wallet'::text) AS detail
   FROM wallet_transactions w
  WHERE NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'wallet_transactions'::text AND s.source_row_id = w.id))
UNION ALL
 SELECT 'company_expense_requests'::text AS source_table,
    e.id AS row_id,
    e.amount,
    e.created_at,
    e.category AS kind,
    COALESCE(e.description, 'Company kharcha'::text) AS detail
   FROM company_expense_requests e
  WHERE e.status = 'approved'::text AND NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'company_expense_requests'::text AND s.source_row_id = e.id))
UNION ALL
 SELECT 'machinery_payments'::text AS source_table,
    p.id AS row_id,
    p.amount,
    p.created_at,
    p.kind,
    COALESCE(p.reference, 'Machinery '::text || p.kind) AS detail
   FROM machinery_payments p
  WHERE p.method <> 'khata'::text AND NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'machinery_payments'::text AND s.source_row_id = p.id))
UNION ALL
 SELECT 'machinery_bills'::text AS source_table,
    b.id AS row_id,
    b.gross_amount AS amount,
    b.created_at,
    'bill'::text AS kind,
    b.bill_number AS detail
   FROM machinery_bills b
  WHERE b.cancelled_at IS NULL AND NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'machinery_bills'::text AND s.source_row_id = b.id))
UNION ALL
 SELECT 'purchases'::text AS source_table,
    p.id AS row_id,
    p.total_amount AS amount,
    p.created_at,
    'received'::text AS kind,
    COALESCE(p.purchase_number, 'Kharid'::text) AS detail
   FROM purchases p
  WHERE p.status = 'received'::purchase_status AND COALESCE(p.total_amount, 0::numeric) > 0::numeric AND NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'purchases'::text AND s.source_row_id = p.id))
UNION ALL
 SELECT 'supplier_payments'::text AS source_table,
    sp.id AS row_id,
    sp.amount,
    sp.created_at,
    COALESCE(sp.payment_method, 'adaigi'::text) AS kind,
    COALESCE(sp.notes, 'Supplier ko adaigi'::text) AS detail
   FROM supplier_payments sp
  WHERE NOT (EXISTS ( SELECT 1
           FROM journal_entry_sources s
          WHERE s.source_table = 'supplier_payments'::text AND s.source_row_id = sp.id));
