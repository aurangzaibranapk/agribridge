# Deploy 184 — sales aur party money guards

Migrations **abhi kisi database par nahi chali**. Testing project `hwaiuwxqldxsoukkfefn` aur Live `ktskwawkslaznkjjacni` ko is kaam mein mat chhedna jab tak Boss backup ki tasdeeq na de dein.

Purana app aur nayi migration alag waqt par mat chalao. 632 shortage ki seedhi entry rok deta hai, aur 631 bari discount par manager code maangta hai. Purana app yeh nahi bhejta.

## 1. Backup

Live backup lo. Khaas tor par function `create_pos_sale_with_credit_approval` ka **11-arg** version save karo (abhi SECURITY INVOKER hai). Rollback file mein wohi purana wrapper hai:

`supabase/migrations/631_pos_server_price_and_refund.rollback.sql`

Backup ka size chat mein aane se pehle koi migration mat chalao.

## 2. Kam rush

Dukan band ya kam rush. Code aur migrations **ek saath**:

1. `631_pos_server_price_and_refund.sql`
2. `632_orders_shift_counters.sql`
3. `633_party_money_guards.sql`
4. isi PR ka app build, foran baad mein

Pehle sirf migration aur baad mein code, ya ulta, mat karo.

## 3. Smoke

- Ek naqad sale
- Ek khata sale
- Ek receipt reprint
- Ek shift jismein kami ho, band karo (kami pending review mein jaye, tankhwah se foran na kate)
- Ek bari discount (5% ya Rs 500 se upar) doosre manager ke code ke sath

## 4. Rollback

Masla aaye to app ka purana build wapas, phir SQL ulti tarteeb:

1. `633_party_money_guards.rollback.sql`
2. `632_orders_shift_counters.rollback.sql`
3. `631_pos_server_price_and_refund.rollback.sql`

## Alag, abhi nahi

`docs/data-fixes/2026-10-20-needs-owner-approval/` — shift close, balances, duplicate customers, finance journals. Owner ki alag ijazat.
