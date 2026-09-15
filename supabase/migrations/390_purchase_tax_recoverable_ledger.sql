-- =====================================================================
-- AgriBridge — Migration 390: Bill ka discount/tax ab ASAL dena banata hai
-- =====================================================================
-- Malik ka kehna (10 September): "jitna bil aaya, itna hamne diya, itna
-- tax tha vo diya, phir discount se baaki payment bachi -- is hisab se
-- tax ki calculation bhi officially system par honi chahiye, taake jab
-- FBR ko tax dene lagen to dikh sake ab tak kis kis ko kitna diya."
--
-- Pehle (389 tak) discount/tax sirf DIKHAYE jate the Purchases list par
-- -- ledger mein supplier ko jo "dena" (2000) banta tha wo abhi bhi sirf
-- qataron ka jama tha, bill ka grand total nahi. Aur advance tax ka
-- kahin apna khata hi nahi tha -- is liye "ab tak kitna tax de chuke
-- hain" ka jawab kisi ke paas nahi tha.
--
-- Advance tax (236G/236H jaisa) hamara KHARCHA nahi -- wo FBR ke paas
-- jama hota hai aur hamari apni tax liability se ADJUST hota hai. Is
-- liye asaason mein: naya khata 1195.
--
-- Ab (code, postGoodsReceived) receiving ke waqt teen qataren:
--   Stock (1200) Dr   = qataron ka jama − discount
--   Tax Recoverable (1195) Dr = tax (sirf jab ho)
--   Supplier Payable (2000) Cr = upar dono ka jama = bill ka grand total
--
-- "Kahan kahan kis ko kitna tax diya" ka jawab ab maujooda Account
-- Ledger safhe (/admin/finance/ledger) se milta hai -- khata "1195 ·
-- Advance Tax Recoverable" chun kar. Nayi safha ki zaroorat nahi thi.
-- =====================================================================

insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values ('1195', 'Advance Tax Recoverable (Supplier bills)', 'asset', 'debit', 1195)
on conflict (code) do nothing;
