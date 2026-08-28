-- =====================================================================
-- Migration 102: Farmer Self-Delivery (Walk-in)
-- =====================================================================
-- Ab tak har entry ke peeche ek MCA hota tha: kisan se doodh MCA leta
-- hai aur chiller tak pahunchata hai. Magar kuch kisan khud chiller par
-- aate hain -- us safar mein MCA ka koi hissa nahi hota.
--
-- Aisi entry par kisi MCA ka naam daal dena (chahe "dummy" hi sahi) do
-- cheezein kharab karta hai: us MCA ki karkardagi mein wo doodh gina
-- jata hai jo us ne uthaya hi nahi, aur us ke route ka nuqsan ghalat
-- nikalta hai (300 litre jo kabhi us ki gaari mein aaya hi nahi, us ke
-- hisaab mein shamil ho jata hai). Is liye yahan MCA ka khana KHALI
-- rehta hai, aur database is par pehra deta hai.
--
-- Do alag baatein, do alag khane -- jaan boojh kar:
--
--   collection_source : doodh chiller tak KAISE pahuncha
--                       (MCA le kar aaya, ya kisan khud le kar aaya)
--   entry_channel     : entry system mein KAISE hui
--                       (website, offline, WhatsApp, app)
--
-- Pehle ek hi khana "source" tha aur us mein channel likha jata tha.
-- Dono ko ek hi khane mein rakhne se aage ki har report ulajh jati:
-- "WhatsApp se aaya doodh" aur "kisan khud laya doodh" ek hi soorat
-- mein nazar aate, jabke in ka aapas mein koi taluq hi nahi.

alter table milk_entries rename column source to entry_channel;
alter table milk_entries rename constraint chk_milk_source to chk_milk_entry_channel;

comment on column milk_entries.entry_channel is
  'Entry system mein kaise hui: website / offline / whatsapp / app.';

alter table milk_entries
  add column if not exists collection_source text not null default 'mca_field',
  add column if not exists received_by_profile_id uuid references profiles(id);

comment on column milk_entries.collection_source is
  'Doodh chiller tak kaise pahuncha: mca_field (MCA laya) ya self_delivery (kisan khud laya).';
comment on column milk_entries.received_by_profile_id is
  'Self-delivery mein doodh kis MCO ne wusool kiya.';

alter table milk_entries drop constraint if exists chk_milk_collection_source;
alter table milk_entries add constraint chk_milk_collection_source
  check (collection_source in ('mca_field', 'self_delivery'));

-- ===== HARD RULE =====
-- Self-delivery mein MCA ka khana khali hona LAZMI hai, aur wusool
-- karne wale MCO ka naam LAZMI hai. Ye rok database mein hai, sirf code
-- mein nahi -- kyunke ghalti yahan chup chaap hoti hai: entry theek
-- nazar aati rehti hai aur farq sirf mahine ke aakhir mein MCA ki
-- report mein nikalta hai, jab tak paisa ada ho chuka hota hai.
alter table milk_entries drop constraint if exists chk_milk_self_delivery_no_mca;
alter table milk_entries add constraint chk_milk_self_delivery_no_mca check (
  (collection_source = 'self_delivery' and mca_profile_id is null and received_by_profile_id is not null)
  or (collection_source = 'mca_field' and mca_profile_id is not null)
);

create index if not exists idx_milk_entries_collection_source on milk_entries(collection_source);
create index if not exists idx_milk_entries_received_by on milk_entries(received_by_profile_id);
