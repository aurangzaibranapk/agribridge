-- Anaj ki adaigi ka udhaar kabhi kata hi nahi -- do enum values ghaib
-- thin.
--
-- src/actions/grain-procurement.ts do jagah likhta hai:
--
--   farmer_credit_ledger.source_type = 'grain_procurement'
--   wallet_transactions.type         = 'grain_cash_payment'
--
-- In mein se koi bhi enum mein maujood nahi tha. Dono insert chup chaap
-- fail hote the -- code error check bhi nahi karta.
--
-- Nateeja paise ka tha, sirf record ka nahi: jab kisi kisan par pehle se
-- udhaar hota aur anaj ki adaigi mein se wo kaata jata, to naqad kam
-- diya jata (yani hum ne kam paisa nikala) magar farmer_credit_ledger
-- mein katauti darj hi nahi hoti. Kisan ka udhaar utna ka utna khara
-- rehta -- yani ek hi udhaar do dafa wasool hone ka raasta khula tha.
--
-- Enum mein value daalna is ka sab se saada aur mahfooz hal hai. Naam
-- wohi rakhe gaye jo code pehle se likh raha hai, taake koi code badalna
-- na pare aur purane record se milaan bhi qaim rahe.

alter type public.credit_source_type add value if not exists 'grain_procurement';
alter type public.wallet_transaction_type add value if not exists 'grain_cash_payment';
