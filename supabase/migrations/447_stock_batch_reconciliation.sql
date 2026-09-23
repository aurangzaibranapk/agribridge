-- AgriBridge — Migration 447: Stock batch reconciliation
--
-- 25 products jinki inventory mein quantity_on_hand thi lekin stock_batches
-- mein koi record nahi tha (ya poori qty cover nahi hoti thi). Ye gap
-- Master Dashboard par Rs 6,183 ka farq dikha raha tha.
--
-- Har row: remaining_quantity = inventory ka current gap, unit_cost = products
-- table ka purchase_price. Batch number RECON-2026 se shuru hota hai taake
-- real purchase batches se alag rehe.
--
-- Testing par verify karo (stock discrepancy zero ho jaye) phir Live par.

INSERT INTO public.stock_batches
  (product_id, batch_number, initial_quantity, remaining_quantity, unit_cost, warehouse_id)
VALUES
  -- Supreme 13g
  ('18c9579e-fb2c-4693-abdb-1f157e6255f7', 'RECON-2026-01', 194, 194, 18.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Fresh Up
  ('f648ec01-d195-476b-a189-18ec40812639', 'RECON-2026-01', 177, 177,  4.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Rain Surf
  ('d36081bb-8a1a-4f38-81d4-e64aaa033cb5', 'RECON-2026-01', 150, 150,  9.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Fair Lovly
  ('5fab458f-4718-48d1-9886-08263596d93e', 'RECON-2026-01', 118, 118,  9.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Predrtor 250Ml
  ('bbbfc5d3-4e6a-4013-a822-d0fafd51d680', 'RECON-2026-01',  87,  87, 66.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Sprite 1.5 Le
  ('f4e6eb2a-7288-40a0-a730-80213c62b546', 'RECON-2026-01',  62,  62, 185.00,  '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Johar Joshanda
  ('a11f13c8-a02f-4fce-9950-d3e3e7b219ff', 'RECON-2026-01',  44,  44, 27.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- COCA COLA 350ML
  ('d1dd52ae-47b1-4fa8-b432-7b838c3e9637', 'RECON-2026-01',  35,  35, 65.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- SPRITE MINT 500ML
  ('83341d1b-6206-482f-8de8-2cb9e69cd2e8', 'RECON-2026-01',  34,  34, 94.74,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Lifeboy Rs10
  ('803aea32-a53d-453e-9ea1-31ccaf5f17ae', 'RECON-2026-01',  33,  33,  9.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Sprite Mint 1.5 Le
  ('fa898e29-d466-409c-8e71-fc957c1721d6', 'RECON-2026-01',  31,  31, 185.00,  '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Sprite 1 Le
  ('9e5fce6b-7fa4-492f-a893-4f3fe04f53c1', 'RECON-2026-01',  30,  30, 135.00,  '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Sprite Mint 2 Le
  ('d76b8085-d561-4a34-a2ef-ac5ffc190e2a', 'RECON-2026-01',  25,  25, 180.00,  '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- DASANI 500ML
  ('a0bbcd70-be2d-4d36-b6e8-386ab0d84002', 'RECON-2026-01',  24,  24, 44.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Sprite Lemon 1 Le
  ('7b8b38e0-b225-4c5b-b69d-68805a4576b9', 'RECON-2026-01',  23,  23, 100.00,  '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- SPRITE MINT 250ML
  ('59eda172-c455-44f9-9244-5e0532ab7609', 'RECON-2026-01',  23,  23, 40.84,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- COKE 250ML
  ('7d4507bc-c5f0-431c-83b6-a4c975455560', 'RECON-2026-01',  22,  22, 40.84,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Dall Masar 250g
  ('5e6a0d4b-73e9-4630-b1f1-78e0aeba27f1', 'RECON-2026-01',  20,  20, 65.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Fanta Anar 500 Ml
  ('48522eb5-3f87-4436-afd1-492ec227cd82', 'RECON-2026-01',  18,  18, 96.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Stainless Steel
  ('20456632-7dbb-4b67-a289-c0c069330096', 'RECON-2026-01',  16,  16, 45.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Deer Glow Pencel
  ('c67c4133-3dc3-48be-9ed0-eeb367a7d947', 'RECON-2026-01',  16,  16, 19.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Mooli Surf
  ('75d24938-0928-452d-8c8d-61c132b247ba', 'RECON-2026-01',  15,  15,  9.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- garam misala sabat
  ('73350b09-e34b-4cc7-80a5-690742e28361', 'RECON-2026-01',  14,  14, 93.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Teezdum
  ('58f7fc7b-e1b9-4348-80e7-5385500d8db5', 'RECON-2026-01',  12,  12, 19.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4'),
  -- Egg
  ('ea3b2887-19b2-4302-8f12-235993b6f5cc', 'RECON-2026-01',  12,  12, 23.00,   '1a4031b3-6abc-4209-9e26-996b69bff7a4');
