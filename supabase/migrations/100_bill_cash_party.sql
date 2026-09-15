-- =====================================================================
-- Migration 100: Bill / Cash submissions — party ki shanakht lazmi
-- =====================================================================
-- Marhala 3 ka bunyadi usool:
--
--   "Cash Paid" ko khud-ba-khud KHARCHA nahi samjha jayega.
--
-- Cash bahar jane ki bohot si wajhein hoti hain — supplier ko adaigi,
-- staff ko advance, HQ ko raqam bhejna. In mein se sirf EK kharcha hai;
-- baqi sab balance ki naql-o-harkat hai. Agar sab ko kharcha likh diya
-- jaye to nafa ghalat nazar aata hai aur supplier ka khata kabhi kam
-- nahi hota.
--
-- Is liye manager ko har cash entry par batana parega ke ye kis qism ki
-- hai aur kis ke sath hui. Ye faisla AI nahi kar sakta — AI ko sirf
-- raqam nazar aati hai, niyat nahi.

alter table whatsapp_submissions
  add column if not exists party_type text,
  add column if not exists party_name text;

comment on column whatsapp_submissions.party_type is
  'Manager ne is cash ko kis qism ka qarar diya (expense / supplier_payment / staff_advance / branch_transfer / customer_receipt / income / other). Cash ki har entry par lazmi.';
comment on column whatsapp_submissions.party_name is
  'Doosra fareeq — kis ko diya ya kis se mila.';

-- ===== HARD RULE =====
-- Cash ki koi bhi entry approve nahi ho sakti jab tak manager ne ye na
-- bata diya ke ye kis qism ki hai aur kis ke sath hui. Ye rok database
-- mein hai, sirf code mein nahi — taake koi bhi raasta (naya code,
-- seedhi SQL, koi aur tool) ise bypass na kar sake.
alter table whatsapp_submissions
  drop constraint if exists chk_cash_party_required;
alter table whatsapp_submissions
  add constraint chk_cash_party_required check (
    kind not in ('cash_paid', 'cash_received')
    or status <> 'approved'
    or (
      party_type is not null
      and party_name is not null
      and length(btrim(party_name)) >= 2
    )
  );

create index if not exists idx_wa_sub_party_type on whatsapp_submissions(party_type);
