do $$
declare
  v_org_id uuid;
  v_grocery_cat_id uuid;
  v_soap_id uuid;
  v_oral_id uuid;
  v_biscuit_id uuid;
  v_bev_id uuid;
  v_pulses_id uuid;
  v_spice_id uuid;
  v_ghee_id uuid;
  v_snacks_id uuid;
  v_tea_id uuid;
  v_cig_id uuid;
  v_existing_count int;
begin
  select id into v_org_id from organizations limit 1;
  select id into v_grocery_cat_id from categories where name = 'Grocery' limit 1;
  if v_grocery_cat_id is null then
    insert into categories (name) values ('Grocery') returning id into v_grocery_cat_id;
  end if;

  select id into v_soap_id from categories where name = 'Soap, Detergent & Personal Care' limit 1;
  if v_soap_id is null then insert into categories (name, parent_category_id) values ('Soap, Detergent & Personal Care', v_grocery_cat_id) returning id into v_soap_id; end if;
  select id into v_oral_id from categories where name = 'Oral & Hygiene Products' limit 1;
  if v_oral_id is null then insert into categories (name, parent_category_id) values ('Oral & Hygiene Products', v_grocery_cat_id) returning id into v_oral_id; end if;
  select id into v_biscuit_id from categories where name = 'Biscuits, Chocolates & Sweets' limit 1;
  if v_biscuit_id is null then insert into categories (name, parent_category_id) values ('Biscuits, Chocolates & Sweets', v_grocery_cat_id) returning id into v_biscuit_id; end if;
  select id into v_bev_id from categories where name = 'Beverages & Cold Drinks' limit 1;
  if v_bev_id is null then insert into categories (name, parent_category_id) values ('Beverages & Cold Drinks', v_grocery_cat_id) returning id into v_bev_id; end if;
  select id into v_pulses_id from categories where name = 'Pulses, Grains & Sugar' limit 1;
  if v_pulses_id is null then insert into categories (name, parent_category_id) values ('Pulses, Grains & Sugar', v_grocery_cat_id) returning id into v_pulses_id; end if;
  select id into v_spice_id from categories where name = 'Spices, Masale & Grocery Items' limit 1;
  if v_spice_id is null then insert into categories (name, parent_category_id) values ('Spices, Masale & Grocery Items', v_grocery_cat_id) returning id into v_spice_id; end if;
  select id into v_ghee_id from categories where name = 'Ghee & Cooking Oil' limit 1;
  if v_ghee_id is null then insert into categories (name, parent_category_id) values ('Ghee & Cooking Oil', v_grocery_cat_id) returning id into v_ghee_id; end if;
  select id into v_snacks_id from categories where name = 'Snacks, Noodles & Desserts' limit 1;
  if v_snacks_id is null then insert into categories (name, parent_category_id) values ('Snacks, Noodles & Desserts', v_grocery_cat_id) returning id into v_snacks_id; end if;
  select id into v_tea_id from categories where name = 'Tea & Health Products' limit 1;
  if v_tea_id is null then insert into categories (name, parent_category_id) values ('Tea & Health Products', v_grocery_cat_id) returning id into v_tea_id; end if;
  select id into v_cig_id from categories where name = 'Cigarettes' limit 1;
  if v_cig_id is null then insert into categories (name, parent_category_id) values ('Cigarettes', v_grocery_cat_id) returning id into v_cig_id; end if;

  select count(*) into v_existing_count from products where category_id in (v_soap_id, v_oral_id, v_biscuit_id, v_bev_id, v_pulses_id, v_spice_id, v_ghee_id, v_snacks_id, v_tea_id, v_cig_id);
  if v_existing_count = 0 then

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_soap_id, 'Ariel Detergent Powder', '1kg', 450, 500),
    (v_org_id, v_soap_id, 'Capri Moisturising Soap', '120g', 60, 75),
    (v_org_id, v_soap_id, 'Dettol Original', '170g', 140, 165),
    (v_org_id, v_soap_id, 'Express Power Powder', '500g', 180, 210),
    (v_org_id, v_soap_id, 'Lifebuoy Soap White', '128g', 55, 70),
    (v_org_id, v_soap_id, 'Lifebuoy Soap White', '98g', 45, 55),
    (v_org_id, v_soap_id, 'Lifebuoy Shampoo Herbal', '80ml', 250, 290),
    (v_org_id, v_soap_id, 'Lifebuoy Shampoo Onion', '80ml', 250, 290),
    (v_org_id, v_soap_id, 'Lux Soap Lotus', '1pc', 55, 70),
    (v_org_id, v_soap_id, 'Lux Soap Nourishing Glow', '1pc', 55, 70),
    (v_org_id, v_soap_id, 'Lux Soap Fresh Splash', '1pc', 55, 70),
    (v_org_id, v_soap_id, 'Lux Soap Soft Touch', '1pc', 55, 70),
    (v_org_id, v_soap_id, 'Lux Soap Velvet Touch', '1pc', 55, 70),
    (v_org_id, v_soap_id, 'OK DW Bar', '265g', 80, 95),
    (v_org_id, v_soap_id, 'OK Neel', '150ml', 60, 75),
    (v_org_id, v_soap_id, 'Palmolive Soap Natural', '1pc', 60, 75),
    (v_org_id, v_soap_id, 'Palmolive Soap Naturals', '1pc', 60, 75),
    (v_org_id, v_soap_id, 'Safeguard Soap Lemon Fresh', '135g', 65, 80),
    (v_org_id, v_soap_id, 'Sunsilk Shampoo Black & Shine', '80ml', 150, 175),
    (v_org_id, v_soap_id, 'Sunsilk Shampoo Black & Shine', '185ml', 320, 370),
    (v_org_id, v_soap_id, 'Surf Excel Powder', '1kg', 480, 540),
    (v_org_id, v_soap_id, 'Surf Excel Powder', '500g', 250, 280);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_oral_id, 'Colgate Toothpaste', '20g', 30, 40),
    (v_org_id, v_oral_id, 'Sensodyne Toothpaste Fluoride', '100g', 380, 430),
    (v_org_id, v_oral_id, 'OK Tissue Face', '160pcs', 180, 210),
    (v_org_id, v_oral_id, 'LED Pencil', '1pc', 20, 30);
insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_biscuit_id, 'Badam Barfi', '1pc', 4, 5),
    (v_org_id, v_biscuit_id, 'Cadbury Perk Chocolate', '8g', 30, 35),
    (v_org_id, v_biscuit_id, 'Candy Original', '1pack', 16, 20),
    (v_org_id, v_biscuit_id, 'Choco Chip Snack Pack', '1pack', 8, 10),
    (v_org_id, v_biscuit_id, 'Cocomo Triple Choc Pouch', '1pack', 42, 50),
    (v_org_id, v_biscuit_id, 'Ding Dong Bubble Gum', '1pc', 8, 10),
    (v_org_id, v_biscuit_id, 'Eclairs Plus Chocolate Box', '1box', 100, 120),
    (v_org_id, v_biscuit_id, 'EMB Rio Strawberry & Vanilla Half Roll', '1pack', 25, 30),
    (v_org_id, v_biscuit_id, 'Fresh Up Xtra Strawberry', '1pack', 15, 20),
    (v_org_id, v_biscuit_id, 'Hilal Cup Cake Strawberry', '1pc', 25, 30),
    (v_org_id, v_biscuit_id, 'LU Candi Original Biscuits', '58g', 35, 40),
    (v_org_id, v_biscuit_id, 'LU Prince Chocolate Snack Pack', '1pack', 42, 50),
    (v_org_id, v_biscuit_id, 'Opus Square Caramel Choco Jar', '1pc', 4, 5),
    (v_org_id, v_biscuit_id, 'P.F Rio Strawberry Vanilla', '1pack', 16, 20),
    (v_org_id, v_biscuit_id, 'PF Sooper Original', '69g', 40, 45),
    (v_org_id, v_biscuit_id, 'Pizzo Soft & Juicy Jelly', 'Rs.5', 4, 5),
    (v_org_id, v_biscuit_id, 'Pizzo Soft & Juicy Jelly', 'Rs.10', 8, 10),
    (v_org_id, v_biscuit_id, 'Twisto Twin Orange & Lemon Jelly', '1pc', 10, 12);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_bev_id, 'Coke', '1L', 140, 160),
    (v_org_id, v_bev_id, 'Nestle Nesfruita Mango', '200ml', 60, 70),
    (v_org_id, v_bev_id, 'Next Cola', '1.5L', 140, 160),
    (v_org_id, v_bev_id, 'Next Cola', '2.25L', 190, 220),
    (v_org_id, v_bev_id, 'Shezan Fruit Drink Mango', '250ml', 45, 55),
    (v_org_id, v_bev_id, 'Sting Berry Blast', '500ml', 100, 120),
    (v_org_id, v_bev_id, 'Goldrinks Juice Mixed Fruit', '1L', 220, 250),
    (v_org_id, v_bev_id, 'Goldrinks Juice Mixed Fruit', '500ml', 130, 150),
    (v_org_id, v_bev_id, 'Goldrinks Juice Mixed Fruit', '350ml', 90, 105),
    (v_org_id, v_bev_id, 'Goldrinks Juice Mango', '1L', 220, 250),
    (v_org_id, v_bev_id, 'Goldrinks Juice Mango', '500ml', 130, 150),
    (v_org_id, v_bev_id, 'Goldrinks Juice Mango', '350ml', 90, 105),
    (v_org_id, v_bev_id, 'Goldrinks Juice Apple', '1L', 220, 250),
    (v_org_id, v_bev_id, 'Goldrinks Juice Apple', '500ml', 130, 150),
    (v_org_id, v_bev_id, 'Goldrinks Juice Apple', '350ml', 90, 105),
    (v_org_id, v_bev_id, 'Goldrinks Juice Orange', '1L', 220, 250),
    (v_org_id, v_bev_id, 'Goldrinks Juice Orange', '500ml', 130, 150),
    (v_org_id, v_bev_id, 'Goldrinks Juice Orange', '350ml', 90, 105);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_pulses_id, 'Daal Masoor', '250g', 75, 90),
    (v_org_id, v_pulses_id, 'Daal Masoor', '500g', 150, 180),
    (v_org_id, v_pulses_id, 'Kalay Chanay', '250g', 70, 85),
    (v_org_id, v_pulses_id, 'Kalay Chanay', '500g', 140, 165),
    (v_org_id, v_pulses_id, 'Rice Sella Steam Kainat', '500g', 130, 150),
    (v_org_id, v_pulses_id, 'Sugar', '1kg', 145, 165),
    (v_org_id, v_pulses_id, 'White Chanay Motay', '250g', 75, 90),
    (v_org_id, v_pulses_id, 'White Chanay Motay', '500g', 150, 175);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_spice_id, 'Garam Masala Powder', '50g', 90, 110),
    (v_org_id, v_spice_id, 'Garam Masala Sabat', '50g', 90, 110),
    (v_org_id, v_spice_id, 'Gool Laal Mirch Sabat', '100g', 100, 120),
    (v_org_id, v_spice_id, 'Guond Ktira', '100g', 150, 180),
    (v_org_id, v_spice_id, 'Mathray Sabat', '50g', 60, 75),
    (v_org_id, v_spice_id, 'Meetha Soda', '100g', 25, 35),
    (v_org_id, v_spice_id, 'National Karhi Gosht Masala', '47g', 60, 75),
    (v_org_id, v_spice_id, 'National Sindhi Biryani Masala', '41g', 60, 75),
    (v_org_id, v_spice_id, 'Shalimar Royal Meva', 'Rs.5', 4, 5),
    (v_org_id, v_spice_id, 'Shan Bombay Biryani Masala', '60g', 65, 80),
    (v_org_id, v_spice_id, 'Shan Sindhi Biryani Masala', '60g', 65, 80),
    (v_org_id, v_spice_id, 'Sufaid Zeera', '50g', 100, 120);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_ghee_id, 'Kashmir Ghee', '1kg', 550, 610),
    (v_org_id, v_ghee_id, 'Kashmir Ghee', '500g', 290, 320),
    (v_org_id, v_ghee_id, 'Kashmir Ghee', '16kg Bucket', 8500, 9200),
    (v_org_id, v_ghee_id, 'Kashmir Premium Gold Cooking Oil', '1L', 500, 560);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_snacks_id, 'Knorr Noodles Chicken', '300g', 150, 175),
    (v_org_id, v_snacks_id, 'Knorr Noodles', 'Rs.50', 42, 50),
    (v_org_id, v_snacks_id, 'Knorr Noodles Chicken', '264g', 130, 150),
    (v_org_id, v_snacks_id, 'Lays Chips', 'Rs.20', 16, 20),
    (v_org_id, v_snacks_id, 'Lays Chips', 'Rs.30', 25, 30),
    (v_org_id, v_snacks_id, 'Lays Chips', 'Rs.50', 42, 50),
    (v_org_id, v_snacks_id, 'Laziza Kheer Mix Pistachio + Coconut', '155g', 130, 155),
    (v_org_id, v_snacks_id, 'Rafhan Jelly Banana', '80g', 55, 65),
    (v_org_id, v_snacks_id, 'Rafhan Jelly Mango', '80g', 55, 65),
    (v_org_id, v_snacks_id, 'Rafhan Jelly Strawberry', '80g', 55, 65);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_tea_id, 'Qarshi Johar Joshanda', '1pack', 60, 75),
    (v_org_id, v_tea_id, 'Supreme Black Tea', '160g', 260, 300),
    (v_org_id, v_tea_id, 'Supreme Black Tea', '7g Sachet', 15, 20),
    (v_org_id, v_tea_id, 'Supreme Black Tea', '85g', 150, 175),
    (v_org_id, v_tea_id, 'Supreme Black Tea Leaf', '430g', 700, 780),
    (v_org_id, v_tea_id, 'Supreme Black Tea Leaf', '900g', 1450, 1600),
    (v_org_id, v_tea_id, 'Vital Tea Leaves', '85g', 155, 180),
    (v_org_id, v_tea_id, 'Vital Tea Leaves Hard Pack', '190g', 320, 360);

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_cig_id, 'Capstan Pall Mall', '20 HL', 350, 380),
    (v_org_id, v_cig_id, 'Gold Flake', '20 HL', 320, 350),
    (v_org_id, v_cig_id, 'Kisaan Cigarettes', '1pack', 250, 280);

  end if;
end $$;