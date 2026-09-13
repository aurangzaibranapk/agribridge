-- Naya payment method: Waseela Card.
--
-- Malik (13 September): "hamare pas ek payment method aur bhi chal raha
-- hai -- Waseela Card, ye new payment method POS mein bhi aur backend
-- par bhi har jagah add karein."
--
-- Doosre digital methods (JazzCash, Easypaisa, QR, Kisan Card) ki tarah
-- ek naya finance_accounts row + payment_method_account_map qatar --
-- taake POS ki bikri seedha sahi GL account (1019) mein post ho.

insert into gl_accounts (code, name, account_type, normal_side, is_active, sort_order)
values ('1019', 'Waseela Card', 'asset', 'debit', true, 1019)
on conflict (code) do nothing;

insert into finance_accounts (name, account_type, opening_balance, current_balance, is_active, gl_code)
values ('Waseela Card', 'mobile_wallet', 0, 0, true, '1019')
on conflict do nothing;

insert into payment_method_account_map (payment_method, finance_account_id)
select 'waseela_card', id from finance_accounts where gl_code = '1019'
on conflict (payment_method) do nothing;

alter table pos_sale_payment_details drop constraint if exists pos_sale_payment_details_payment_method_check;
alter table pos_sale_payment_details add constraint pos_sale_payment_details_payment_method_check
  check (payment_method = any (array['cash', 'bank_transfer', 'card', 'jazzcash', 'easypaisa', 'qr', 'khata', 'waseela_card']));

alter table machinery_payments drop constraint if exists chk_machinery_payment_method;
alter table machinery_payments add constraint chk_machinery_payment_method
  check (method = any (array['cash', 'bank', 'wallet', 'khata', 'other', 'vendor_collected', 'lifter_collected', 'waseela_card']));
