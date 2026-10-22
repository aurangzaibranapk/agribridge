-- 709 rollback. Testing par. Live par mat chalana.
-- 708 ne bills ki purani created_at mita di. Jo 17 bills aaj par hain, wahi rehti hain.
-- Un ki pehle wali waqt wapas nahi aa sakti.

delete from public.pos_sales
where receipt_no like 'TEST-709-%';

update public.agri_orders
set
  status = 'draft',
  notes = nullif(btrim(regexp_replace(coalesce(notes, ''), '\s*TEST phone 709\s*', ' ', 'g')), '')
where status = 'dispatched'
  and notes like '%TEST phone 709%';

update public.dairy_health_events
set voided = true, void_reason = 'TEST phone 709 rollback'
where notes = 'TEST phone 709'
  and not voided;
