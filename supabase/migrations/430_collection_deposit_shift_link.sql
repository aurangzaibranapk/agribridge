-- =====================================================================
-- AgriBridge — Migration 430: Bank deposit ka apna shift se rishta
-- =====================================================================
-- Malik (16 September): "Purani Shift ka Cash Bhejein" modal mein
-- "sare banks aana chahiye ... receipt bhi upload karna chahiye" --
-- yani Manager/Finance ko hath mein dene ke ilawa, wahin se seedha
-- BANK mein jama kara kar slip lagane ka raasta bhi.
--
-- Wo raasta (`pos_collection_deposits`, `/admin/my-collection`) pehle
-- se maujood hai, shop-level "Outstanding" ka apna alag nizam. Isay
-- shift-close modal mein la kar istemal karna hai -- magar us se
-- pehle ek chhoti kami: is table ka kisi POS shift se koi rishta nahi
-- tha. Us ke baghair, is raaste se jama karayi gayi raqam shift ki
-- "Purani cash bhejna baqi" wali amber patti kabhi band nahi karti --
-- staff ne jama kara di, magar system abhi bhi "baqi hai" kehta rehta.
alter table pos_collection_deposits
  add column if not exists shift_id uuid references pos_shifts(id);

comment on column pos_collection_deposits.shift_id is
  'Agar ye deposit seedha Shift Close ke "Cash Bhejein" se ki gayi -- taake us shift ki "cash bhejna baqi" patti dobara na dikhe.';
