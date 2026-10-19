-- =====================================================================
-- PROPOSAL ONLY -- NOT RUN.  Product selling-unit label fixes
-- Shop: Kisaan Karyana Mahabali (263f1d55-91f4-4866-8c34-b1df7e5d1651)
-- Prepared: 2026-10-19 (Asia/Karachi) from a read-only SELECT on live.
--
-- Problem: products.unit / unit_code hold a MEASURE instead of the
-- SELLING unit -- e.g. "Coke 2L" = Litre (ltr), "Coke CAN 250ML" =
-- Milligram (mg), "Supreme 450g" = Kilogram (kg) -- and most karyana items
-- are blank. Receipts/stock screens then read "1 Litre" for one bottle.
--
-- Fix: set unit/unit_code to the piece you actually sell (btl / can / pkt /
-- pcs -- all already exist in public.units). pack_size (2Litter, 350ml,
-- 450g ...) is NOT touched; it keeps the volume/weight text.
-- POS stock maths do not read unit/unit_code (pos_line_stock_units uses
-- units_per_pack), so this is a label-only change. Prices, stock, ledger:
-- untouched.
--
-- Each UPDATE is guarded on the CURRENT value, so a row someone has
-- already corrected is skipped. Review the "pkt"/"pcs" guesses for the
-- blank items with the shop before approving.
--
-- How to run (only after owner approval, and after a backup):
--   1. Backup:  create table backup_products_units_20261019 as
--               select id, unit, unit_code from public.products
--               where id in (<ids below>);
--   2. Run this file; it ends in ROLLBACK. Check the counts, then change
--      the last line to COMMIT and run again.
-- =====================================================================
begin;

-- Arq gulab  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'b4faedd9-92a5-415d-99e3-9fb412cd7bf9' and unit_code is null and unit is null;
-- Arq sounf  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'b22fb56e-9a1a-4827-a91d-5bea4131c453' and unit_code is null and unit is null;
-- Besan 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'a218a692-2855-4970-9832-5ce17b2c4f68' and unit_code is null and unit is null;
-- Black chana 250  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '85da65f5-c5c4-49f0-8e0c-3d861aded8fb' and unit_code is null and unit is null;
-- Black chana 500  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '805dbfb8-a51a-4f79-b124-571dc9d30714' and unit_code is null and unit is null;
-- Black mirch powder  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '6056494d-12f0-425c-b402-f7d455d5be48' and unit_code is null and unit is null;
-- Black mirch sabat  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'fbf4c412-fed3-437d-a15f-26f8aaa00265' and unit_code is null and unit is null;
-- Bonus  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '82d4bcb5-1bb6-4eac-95a6-0cfcd4d9d9d9' and unit_code is null and unit is null;
-- Candi  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '907a58dd-dbe9-492c-b632-fbb3121a9733' and unit_code is null and unit is null;
-- Capri  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'a02b6c37-f38b-4105-8047-02198c2a831a' and unit_code is null and unit is null;
-- capstan  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '7c75402d-6ad5-4115-bad4-ffa31f82e04e' and unit_code is null and unit is null;
-- chat recipe mix  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'b571725a-c596-4a15-94de-c9ede9f8201b' and unit_code is null and unit is null;
-- chicken tikka  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '7c4007d3-6ff9-42a1-8f18-1ef223524a0e' and unit_code is null and unit is null;
-- Chicken Tikka 100g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '065d9a69-a47e-4349-a5e5-cebaa05012eb' and unit_code is null and unit is null;
-- Chili Powder 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '8abea708-19a2-4884-9ca2-a120c193d3ef' and unit_code is null and unit is null;
-- chilipowder  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '7a251ec8-43ba-48ed-8d2d-aae14fefe877' and unit_code is null and unit is null;
-- cocomo  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'cb3657a8-7e83-4e7f-8cc9-9963dd5a1233' and unit_code is null and unit is null;
-- Coke 1.5L  (now: blank; pack_size: Litre (ltr)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'da67da99-1495-469a-a456-7fd4fe592d37' and unit_code is null and unit is null;
-- Coke 1L  (now: Litre (ltr); pack_size: 1 Le) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'd58a50b6-f2ea-42f2-8735-457c3635a2ee' and unit_code = 'ltr';
-- Coke 250ML  (now: blank; pack_size: Millilitre (ml)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '7d4507bc-c5f0-431c-83b6-a4c975455560' and unit_code is null and unit is null;
-- Coke 2L  (now: Litre (ltr); pack_size: 2Litter) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '60720a57-0c19-4fcc-8315-833eedb5005c' and unit_code = 'ltr';
-- Coke 350ML  (now: Litre (ltr); pack_size: 350ml) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'd1dd52ae-47b1-4fa8-b432-7b838c3e9637' and unit_code = 'ltr';
-- Coke 500ml  (now: blank; pack_size: Millilitre (ml)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'c3793f97-f140-4f82-b97d-714689ee729a' and unit_code is null and unit is null;
-- Coke CAN 250ML  (now: Milligram (mg); pack_size: -) -> Can (can)  [soft drink can]
update public.products set unit = 'Can (can)', unit_code = 'can' where id = '1988eb18-1189-48e3-8154-c31adfdad4c8' and unit_code = 'mg';
-- colgate  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'f7fe37b1-86f2-4586-8f7a-c55ab627c158' and unit_code is null and unit is null;
-- Colgate 22g  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'ee49f606-f280-4e11-951b-86cd9f53cbd7' and unit_code is null and unit is null;
-- cupcake  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '27bb78cb-9273-4f07-a63a-762244664109' and unit_code is null and unit is null;
-- Dall Masar 250g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '5e6a0d4b-73e9-4630-b1f1-78e0aeba27f1' and unit_code is null and unit is null;
-- dall masar 500  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'e9c76fdc-4b91-4d67-a445-65bbe0e56900' and unit_code is null and unit is null;
-- Darchini  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'b3af9d64-7e7e-4a46-882f-a947ef1ca646' and unit_code is null and unit is null;
-- DASANI 1.5L  (now: Litre (ltr); pack_size: 1.5Litter) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '73eb911e-2a08-4460-9c10-6117a6bf7481' and unit_code = 'ltr';
-- DASANI 500ML  (now: Litre (ltr); pack_size: 500ml) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'a0bbcd70-be2d-4d36-b6e8-386ab0d84002' and unit_code = 'ltr';
-- Deer Glow Pencel  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'c67c4133-3dc3-48be-9ed0-eeb367a7d947' and unit_code is null and unit is null;
-- Desi Ghee  (now: blank; pack_size: 1kg) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '9a50393f-c747-43b2-899a-5a8d8c3437b7' and unit_code is null and unit is null;
-- dhall maser 250  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'b03b1923-dbd7-4e2e-a8bf-e0825f554553' and unit_code is null and unit is null;
-- Dhania Powder 125g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'c5d677b3-ed4d-43c8-8dc0-4f5f5acfc7bd' and unit_code is null and unit is null;
-- dhaniya powde 250  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '16b68dd3-89a9-4eb4-b505-f251c4256b4e' and unit_code is null and unit is null;
-- dhaniya powder 100  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'c9aacaff-fdb9-4232-9703-b01825a6ce24' and unit_code is null and unit is null;
-- dingdong  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '8f32e80c-458c-4edc-b259-9dd896ef6be0' and unit_code is null and unit is null;
-- Egg  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'ea3b2887-19b2-4302-8f12-235993b6f5cc' and unit_code is null and unit is null;
-- Fair Lovly  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '5fab458f-4718-48d1-9886-08263596d93e' and unit_code is null and unit is null;
-- Fanta 1.5 Le  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '68b913a2-30d9-4adb-9fb7-8b4d83b4efd3' and unit_code is null and unit is null;
-- Fanta 350ml  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '07e9ca65-02ab-4126-8963-8e5bfa59a252' and unit_code is null and unit is null;
-- Fanta Anar 500 Ml  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '48522eb5-3f87-4436-afd1-492ec227cd82' and unit_code is null and unit is null;
-- Fanta Orange 2Le  (now: Litre (ltr); pack_size: 6) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'c1b73c20-5f43-425b-984e-cd6725b7004f' and unit_code = 'ltr';
-- Fresh Up  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'f648ec01-d195-476b-a189-18ec40812639' and unit_code is null and unit is null;
-- freshup  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'f6adc3f3-4d8a-4773-a2ab-3a7ee649808b' and unit_code is null and unit is null;
-- garam misala powder  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'f56f0123-84eb-4630-bf97-9e1bf64e1134' and unit_code is null and unit is null;
-- garam misala sabat  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '73350b09-e34b-4cc7-80a5-690742e28361' and unit_code is null and unit is null;
-- garammasala  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'dc4d2f56-ae10-47b3-96a9-7c84e212b289' and unit_code is null and unit is null;
-- Garlic powder  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '0b96f75b-1de3-4507-857d-23962276012f' and unit_code is null and unit is null;
-- gingger powder  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'aaa70cf0-d7ff-4beb-9db3-1b01ac16273c' and unit_code is null and unit is null;
-- Gold Flake  (now: blank; pack_size: 20 HL) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '83a38c80-c38b-4531-b188-97f043a63cae' and unit_code is null and unit is null;
-- Haldhi Powder 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'b016bb01-3cc0-40f7-9923-a7d42b31e98a' and unit_code is null and unit is null;
-- haldipowder  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '9b1540a2-8200-4954-9c27-ab673a00d5e8' and unit_code is null and unit is null;
-- Hunny Food Colour  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'b3a5ea0e-798f-4298-a169-00cdf7c3f16d' and unit_code is null and unit is null;
-- Jaifal 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '7f304727-4c55-4576-a0f7-4c17233b8eed' and unit_code is null and unit is null;
-- Johar Joshanda  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'a11f13c8-a02f-4fce-9950-d3e3e7b219ff' and unit_code is null and unit is null;
-- Kali Mirch Sabut 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '47c48f28-b163-4c3f-9a58-d79498a2105d' and unit_code is null and unit is null;
-- Kalonji  (now: Gram (gm); pack_size: 50) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '02358e90-2c0d-4c3c-924b-7fc49cff9c87' and unit_code = 'gm';
-- karahi  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '2b357db8-d4b4-4c6f-9e3c-7c6a14dc8415' and unit_code is null and unit is null;
-- Kashmir 500g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'ef21ad21-2dee-4134-8363-a7ae65f1a8d5' and unit_code is null and unit is null;
-- Kashnir Premium Gold 1Kg  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'c5bb458b-0277-43e3-b20c-2f7b942be6e5' and unit_code is null and unit is null;
-- kasuri methi  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '56b69a77-1d26-4be3-8a8e-ecbce16ef272' and unit_code is null and unit is null;
-- Kheer Mix 155g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '14e4db8a-f8fc-47a5-b910-4db64f9bd97e' and unit_code is null and unit is null;
-- kisan  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '329e00fc-3506-4cb2-a74d-798d006a60b5' and unit_code is null and unit is null;
-- knorchattpatta  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '8f80cbe9-2150-4a71-a945-337121ab6f5b' and unit_code is null and unit is null;
-- knorschick  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '798d2fef-8d1f-446b-b307-6ddce66f0d4b' and unit_code is null and unit is null;
-- Laung 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'f1c7355d-42aa-46ed-9d7b-317c26371483' and unit_code is null and unit is null;
-- Lays  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '262813cd-e463-41cc-84ed-04a9e975a241' and unit_code is null and unit is null;
-- Laziza kheer  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '076f7798-a2cd-4a51-9f35-454f923f5001' and unit_code is null and unit is null;
-- lifeboy  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'dc5122d4-1be2-4353-8557-520845cacb36' and unit_code is null and unit is null;
-- Lifeboy Rs10  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '803aea32-a53d-453e-9ea1-31ccaf5f17ae' and unit_code is null and unit is null;
-- Lifeboy Silky 90g  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'fb941657-40f8-4af0-87e4-64c328dc9d9e' and unit_code is null and unit is null;
-- Lifeboy Strong 175 Ml  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '22e7d9b6-92ff-420b-bba5-ab2fb3c91151' and unit_code is null and unit is null;
-- Lux  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '354f1f17-0262-478d-baa7-740eb3a48846' and unit_code is null and unit is null;
-- Lux Nourished Glow 123g  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '5d778052-afe5-43ef-9ebe-9cd4a14cbb38' and unit_code is null and unit is null;
-- makhanbadami  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'd4adf3c1-ae21-4461-825f-42561c3dfb04' and unit_code is null and unit is null;
-- Methry 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '1b610cd1-0b96-46f8-84e1-5625251dcac8' and unit_code is null and unit is null;
-- Mooli  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'd5d98518-5f57-445e-ba33-3655ce104028' and unit_code is null and unit is null;
-- Mooli Surf  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '75d24938-0928-452d-8c8d-61c132b247ba' and unit_code is null and unit is null;
-- Motti Elaichi 50g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'dbf98e91-a68a-4a62-b35d-00d0528dec10' and unit_code is null and unit is null;
-- Ok Neel 150 Ml  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '823048ba-9e85-4cf4-881f-e1c6ff329b82' and unit_code is null and unit is null;
-- Ok Tissue Box  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '9b47edd3-8aa6-418b-bb6e-9c817153a7da' and unit_code is null and unit is null;
-- palmolive  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '078b1f85-01e1-4449-99dc-8ce5e8acac99' and unit_code is null and unit is null;
-- perk  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '8114373a-39e9-405a-aa37-13f027b80570' and unit_code is null and unit is null;
-- Pizzo  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '3dce326c-c5d6-4b75-a96f-7e7ffcaeb7f6' and unit_code is null and unit is null;
-- Predator 250Ml  (now: blank; pack_size: Millilitre (ml)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'bbbfc5d3-4e6a-4013-a822-d0fafd51d680' and unit_code is null and unit is null;
-- Prince  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '431c0c15-aecc-4f5b-b739-d662772758f1' and unit_code is null and unit is null;
-- quorma  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'a8abe9ec-f7bf-4d71-8370-1a7284d3dacb' and unit_code is null and unit is null;
-- Rafhan Jeely 80g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '81182282-5270-4808-b0cc-6f82eaa989a7' and unit_code is null and unit is null;
-- Rain Surf  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'd36081bb-8a1a-4f38-81d4-e64aaa033cb5' and unit_code is null and unit is null;
-- Red mirch  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '9e587ab4-b18a-4368-b840-5a6e375923bb' and unit_code is null and unit is null;
-- Rin  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'e971389d-a285-471b-acfb-ad56d58f3159' and unit_code is null and unit is null;
-- Rio  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '0260e827-5577-44da-9d2b-eeb881923636' and unit_code is null and unit is null;
-- sabat maser 250G  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'bc7bcde7-4b5c-4b88-88e8-2dbfe02810f0' and unit_code is null and unit is null;
-- Sabut Masar Chilka 500g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '315757ba-4e60-470d-b5b3-f1b4ae4ac1ad' and unit_code is null and unit is null;
-- Sabut Masoor 250g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'd4afc756-2b10-4ae9-9a44-efe8f8d491e2' and unit_code is null and unit is null;
-- safeguard  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '2ae84311-9490-485d-a2f0-44c4cbe7c31c' and unit_code is null and unit is null;
-- Sawiyan Barik  (now: Gram (gm); pack_size: 500) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'e64403e1-9020-456f-a8e9-b96672edfe57' and unit_code = 'gm';
-- Sawiyan Barik  (now: Gram (gm); pack_size: 350) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'a2ae6aa6-7f6e-4186-985f-81d1436ce169' and unit_code = 'gm';
-- Sawiyan Moti  (now: Gram (gm); pack_size: 350) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '3e215174-872f-4ecf-bf2e-41371a4a783f' and unit_code = 'gm';
-- Sawiyan Moti  (now: Gram (gm); pack_size: 500) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '9ea541bf-f96e-40b8-8cb4-f11114fa7284' and unit_code = 'gm';
-- sensodane  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '259154c1-449a-48db-9014-f47196072c52' and unit_code is null and unit is null;
-- Sensodyne 100g  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'ff017112-c78d-49cb-9041-1cc95c8640a5' and unit_code is null and unit is null;
-- Sindhi Biryani  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'fc844ab6-3ff1-4996-af15-7d2433b6a617' and unit_code is null and unit is null;
-- Sprite 1 Le  (now: blank; pack_size: Litre (ltr)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '9e5fce6b-7fa4-492f-a893-4f3fe04f53c1' and unit_code is null and unit is null;
-- Sprite 1.5 Le  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'f4e6eb2a-7288-40a0-a730-80213c62b546' and unit_code is null and unit is null;
-- SPRITE 2L  (now: Litre (ltr); pack_size: 2Litter) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'ebbfc7ec-6701-4433-b4f9-5101728bf736' and unit_code = 'ltr';
-- Sprite 350 Ml  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '6057ab47-8a29-4604-aab2-7e939aa626fa' and unit_code is null and unit is null;
-- SPRITE 350ML  (now: Litre (ltr); pack_size: 350ml) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '5076b55c-f884-4503-92ee-09839ce64280' and unit_code = 'ltr';
-- Sprite 500 Ml  (now: blank; pack_size: Millilitre (ml)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'dd15c1e0-435d-4c96-98c2-d34a4b78fdba' and unit_code is null and unit is null;
-- Sprite CAN 250ML  (now: Milligram (mg); pack_size: -) -> Can (can)  [soft drink can]
update public.products set unit = 'Can (can)', unit_code = 'can' where id = 'd562eac7-449e-43ec-9c5e-8006cae611d9' and unit_code = 'mg';
-- Sprite Lemon 1 Le  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '7b8b38e0-b225-4c5b-b69d-68805a4576b9' and unit_code is null and unit is null;
-- Sprite Mint 1 Le  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'd45f10f2-844b-43f1-b1de-cf27b16e4240' and unit_code is null and unit is null;
-- Sprite Mint 1.5 Le  (now: blank; pack_size: Litre (ltr)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'fa898e29-d466-409c-8e71-fc957c1721d6' and unit_code is null and unit is null;
-- Sprite Mint 2 Le  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'd76b8085-d561-4a34-a2ef-ac5ffc190e2a' and unit_code is null and unit is null;
-- Sprite Mint 250ML  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '59eda172-c455-44f9-9244-5e0532ab7609' and unit_code is null and unit is null;
-- Sprite Mint 350ml  (now: blank; pack_size: Millilitre (ml)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '06cf624f-ec2e-478a-9152-9dfbedb777f5' and unit_code is null and unit is null;
-- Sprite Mint 500ML  (now: blank; pack_size: Millilitre (ml)) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = '83341d1b-6206-482f-8de8-2cb9e69cd2e8' and unit_code is null and unit is null;
-- Stainless Steel  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '20456632-7dbb-4b67-a289-c0c069330096' and unit_code is null and unit is null;
-- sunlight  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'dfe99dc8-5584-4744-9f91-74774f3be643' and unit_code is null and unit is null;
-- sunsilk  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'aa4c812f-e89a-4a15-bd82-778ce344b5df' and unit_code is null and unit is null;
-- Sunsilk 185 Ml  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '0e28609f-0f35-4776-a464-4933091c1539' and unit_code is null and unit is null;
-- supreme  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '85ab0b70-5990-4704-8908-6b873d82acbc' and unit_code is null and unit is null;
-- Supreme 13g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '18c9579e-fb2c-4693-abdb-1f157e6255f7' and unit_code is null and unit is null;
-- Supreme 170g  (now: blank; pack_size: 170g) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '1c2af823-d807-4a2e-9568-84144472d109' and unit_code is null and unit is null;
-- Supreme 450g  (now: Kilogram (kg); pack_size: 450g) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '30cfc556-8e2a-4924-9c0c-66f21dc841a9' and unit_code = 'kg';
-- Supreme 85 g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '588c772c-eee2-438c-82dc-777045abcb61' and unit_code is null and unit is null;
-- surfexcel  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'ced49e80-99a2-4a1f-bef3-d8b7c3b83d61' and unit_code is null and unit is null;
-- Sweep  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = '24aa6f6c-2d5e-4f36-ae20-9c9d9a2a0bef' and unit_code is null and unit is null;
-- Teezdum  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '58f7fc7b-e1b9-4348-80e7-5385500d8db5' and unit_code is null and unit is null;
-- Tukhm-e-Malanga 100g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '7d482760-9c51-4aa9-a0df-da2d73a3b8d9' and unit_code is null and unit is null;
-- veet  (now: blank; pack_size: -) -> Pieces (pcs)  [single piece]
update public.products set unit = 'Pieces (pcs)', unit_code = 'pcs' where id = 'a2c9c726-cbcf-431d-90e6-681e633160dd' and unit_code is null and unit is null;
-- venigarsirka  (now: blank; pack_size: -) -> Bottles (btl)  [bottle]
update public.products set unit = 'Bottles (btl)', unit_code = 'btl' where id = 'd2aaff49-253f-4830-b03b-0afd2a2c3378' and unit_code is null and unit is null;
-- vital  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = 'df7b1b6b-80a4-4b38-b2e4-ba2bf344b1c2' and unit_code is null and unit is null;
-- Vital 170g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '4785a375-04ff-4ef7-863c-865339bca6a3' and unit_code is null and unit is null;
-- White Chana 250g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '41420e00-c681-46e7-a07c-93ffea8d221a' and unit_code is null and unit is null;
-- White Chana 500g  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '7e5fd270-a775-4897-ab88-1a10166135eb' and unit_code is null and unit is null;
-- White Zeera 50  (now: blank; pack_size: -) -> Packet (pkt)  [packet / sachet]
update public.products set unit = 'Packet (pkt)', unit_code = 'pkt' where id = '28225c1f-76cd-41cd-a85a-0757959d7f1e' and unit_code is null and unit is null;

-- Check: how many rows still use a measure as selling unit in this shop
select unit_code, count(*) from public.products
 where id in (select product_id from public.inventory inv join public.warehouses w on w.id = inv.warehouse_id
              where w.shop_id = '263f1d55-91f4-4866-8c34-b1df7e5d1651')
 group by 1 order by 2 desc;

rollback;  -- change to COMMIT only after owner approval
