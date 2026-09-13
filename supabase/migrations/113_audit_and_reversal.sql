-- =====================================================================
-- Migration 113: Audit ka safha aur reversal ka raasta
-- =====================================================================
-- 106 se ye baat baar baar kahi ja rahi hai: "ghalti mitane se nahi,
-- reversal se theek hoti hai". Aur wo baat sach hai -- reverseJournal()
-- 106 mein likha ja chuka hai aur database us ko manta hai.
--
-- Magar us ko bulane ka koi RAASTA nahi tha. Yani system kehta tha
-- "ghalti reversal se theek karein" aur reversal karne ka koi tareeqa
-- deta hi nahi tha. Aisa nizam logon ko database tak jane par majboor
-- karta hai -- yani theek us jagah, jahan koi rok nahi.
--
-- Doosri baat: audit ka record khud mehfooz hona chahiye.
--
-- audit_logs ab tak aam table thi -- koi bhi qatar badal ya mita sakta
-- tha. Aisi audit trail audit trail nahi hoti; wo sirf ek fehrist hoti
-- hai jis par bharosa kiya jata hai bina kisi wajah ke. Jo shakhs kuch
-- chhupana chahe, us ke liye pehla qadam yehi hota hai ke apna nishan
-- mita de.
--
-- Teesri baat, aur shayad sab se ahem: PURANI TAREEKH ki entry aur
-- REVERSAL, dono jaiz kaam hain. Inhen rokna ghalat hoga -- ghalti hoti
-- hai, aur kabhi kabhi entry waqai us din ki hoti hai jo guzar chuka.
-- Magar yehi do jagahen hain jahan haath ki safai chhup sakti hai. Is
-- liye inhen roka nahi jata -- inhen NAZAR MEIN rakha jata hai.

-- ---------------------------------------------------------------
-- 1) Audit ka record khud mehfooz
-- ---------------------------------------------------------------
create or replace function fn_no_audit_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit ka record badla ya mitaya nahi ja sakta. Jo hua wo hua -- us ka nishan rehna hi is fehrist ka maqsad hai.';
end;
$$;

drop trigger if exists trg_no_audit_change on audit_logs;
create trigger trg_no_audit_change
  before update or delete on audit_logs
  for each row execute function fn_no_audit_change();

-- ---------------------------------------------------------------
-- 2) Wo entriyan jo nazar mein rehni chahiyen
-- ---------------------------------------------------------------
-- Purani tareekh ki entry, aur wo entriyan jo ulti gayin. Dono jaiz --
-- magar dono ek hi jagah dikhni chahiyen, taake tarteeb nazar aaye:
-- ek hi shakhs har hafte purani tareekh mein entry daal raha ho, ya ek
-- hi qism ki entry baar baar ulti ja rahi ho, to ye baat sirf tab nazar
-- aati hai jab sab ek jagah ho.
create or replace view v_ledger_watch
with (security_invoker = true) as
  select
    e.id,
    e.entry_number,
    e.entry_date,
    e.description,
    e.source_module,
    e.created_at,
    p.full_name as kis_ne,
    case
      when e.is_reversal then 'reversal'
      when e.is_backdated then 'backdated'
    end as kism,
    coalesce(e.reversal_reason, e.backdate_reason) as wajah,
    orig.entry_number as asal_entry,
    (select coalesce(sum(l.debit), 0) from journal_lines l where l.entry_id = e.id) as raqam,
    (e.created_at::date - e.entry_date) as din_ka_faasla
  from journal_entries e
  left join profiles p on p.id = e.created_by
  left join journal_entries orig on orig.id = e.reversal_of
  where e.is_reversal or e.is_backdated;

-- ---------------------------------------------------------------
-- 3) Safha
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('audit-trail', 'Kis Ne Kya Kiya', '/admin/audit-trail', 'History', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'audit-trail', 10),
('finance', 'audit-trail', 9),
('admin', 'audit-trail', 20)
on conflict do nothing;

-- Reversal ka haq sirf un ke paas jo hisaab ke zimmedar hain. Ye rok
-- bharose ki wajah se nahi -- reversal ek maali kaam hai, aur maali
-- kaam ka haq usi ke paas hona chahiye jo us ka jawab de sake.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('finance', 'audit-trail', array['view','reject','export']::text[], 'all'),
('manager', 'audit-trail', array['view']::text[], 'own_branch')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
