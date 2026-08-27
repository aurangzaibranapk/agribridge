-- =====================================================================
-- AgriBridge — Migration 063: Grocery/Karyana Starter Catalog
-- =====================================================================
-- Creates "Grocery" main category + sub-categories, and seeds ~45
-- common Pakistani karyana items with placeholder prices (admin can
-- edit prices/add photos anytime from Products page - this is just a
-- ready starting point instead of an empty list).

do $$
declare
  v_org_id uuid;
  v_grocery_cat_id uuid;
  v_rice_id uuid;
  v_oil_id uuid;
  v_daal_id uuid;
  v_spice_id uuid;
  v_sugar_id uuid;
  v_tea_id uuid;
  v_soap_id uuid;
  v_snacks_id uuid;
  v_personal_id uuid;
begin
  select id into v_org_id from organizations limit 1;

  -- Main "Grocery" category (matches CategoryDashboard's categoryName="Grocery")
  select id into v_grocery_cat_id from categories where name = 'Grocery' limit 1;
  if v_grocery_cat_id is null then
    insert into categories (name) values ('Grocery') returning id into v_grocery_cat_id;
  end if;

  -- Sub-categories under Grocery
  insert into categories (name, parent_category_id) values ('Rice & Grains', v_grocery_cat_id) returning id into v_rice_id;
  insert into categories (name, parent_category_id) values ('Cooking Oil & Ghee', v_grocery_cat_id) returning id into v_oil_id;
  insert into categories (name, parent_category_id) values ('Pulses (Daal)', v_grocery_cat_id) returning id into v_daal_id;
  insert into categories (name, parent_category_id) values ('Spices & Masala', v_grocery_cat_id) returning id into v_spice_id;
  insert into categories (name, parent_category_id) values ('Sugar & Salt', v_grocery_cat_id) returning id into v_sugar_id;
  insert into categories (name, parent_category_id) values ('Tea & Beverages', v_grocery_cat_id) returning id into v_tea_id;
  insert into categories (name, parent_category_id) values ('Soap & Detergent', v_grocery_cat_id) returning id into v_soap_id;
  insert into categories (name, parent_category_id) values ('Snacks & Biscuits', v_grocery_cat_id) returning id into v_snacks_id;
  insert into categories (name, parent_category_id) values ('Personal Care', v_grocery_cat_id) returning id into v_personal_id;

  -- Rice & Grains
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_rice_id, 'Basmati Rice', '1kg', 280, 320),
    (v_org_id, v_rice_id, 'Sella Rice', '1kg', 220, 260),
    (v_org_id, v_rice_id, 'Wheat Flour (Atta)', '10kg', 1400, 1550),
    (v_org_id, v_rice_id, 'Maida', '1kg', 130, 150),
    (v_org_id, v_rice_id, 'Suji', '1kg', 140, 160);

  -- Cooking Oil & Ghee
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_oil_id, 'Sunflower Cooking Oil', '1L', 480, 540),
    (v_org_id, v_oil_id, 'Sunflower Cooking Oil', '5L', 2300, 2550),
    (v_org_id, v_oil_id, 'Banaspati Ghee', '1kg', 500, 560),
    (v_org_id, v_oil_id, 'Desi Ghee', '1kg', 1800, 2000),
    (v_org_id, v_oil_id, 'Mustard Oil', '1L', 450, 500);

  -- Pulses (Daal)
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_daal_id, 'Chana Daal', '1kg', 260, 300),
    (v_org_id, v_daal_id, 'Masoor Daal', '1kg', 280, 320),
    (v_org_id, v_daal_id, 'Moong Daal', '1kg', 300, 340),
    (v_org_id, v_daal_id, 'Maash Daal', '1kg', 320, 360),
    (v_org_id, v_daal_id, 'Sabut Chana', '1kg', 240, 280);

  -- Spices & Masala
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_spice_id, 'Red Chilli Powder', '200g', 150, 180),
    (v_org_id, v_spice_id, 'Turmeric Powder (Haldi)', '200g', 130, 160),
    (v_org_id, v_spice_id, 'Coriander Powder', '200g', 120, 150),
    (v_org_id, v_spice_id, 'Garam Masala', '100g', 140, 170),
    (v_org_id, v_spice_id, 'Cumin Seeds (Zeera)', '200g', 200, 240),
    (v_org_id, v_spice_id, 'Salt (Iodized)', '800g', 40, 55);

  -- Sugar & Salt
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_sugar_id, 'White Sugar', '1kg', 140, 160),
    (v_org_id, v_sugar_id, 'Brown Sugar (Shakkar)', '1kg', 160, 190);

  -- Tea & Beverages
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_tea_id, 'Tea Leaves (Chai Patti)', '190g', 260, 300),
    (v_org_id, v_tea_id, 'Tea Leaves (Chai Patti)', '900g', 1200, 1350),
    (v_org_id, v_tea_id, 'Milk Powder', '400g', 550, 620),
    (v_org_id, v_tea_id, 'Instant Coffee', '50g', 350, 400);

  -- Soap & Detergent
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_soap_id, 'Bath Soap', '1pc', 60, 80),
    (v_org_id, v_soap_id, 'Washing Powder', '1kg', 220, 260),
    (v_org_id, v_soap_id, 'Dishwash Liquid', '500ml', 180, 220),
    (v_org_id, v_soap_id, 'Toilet Cleaner', '500ml', 160, 190);

  -- Snacks & Biscuits
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_snacks_id, 'Biscuits (Assorted)', '1pack', 40, 55),
    (v_org_id, v_snacks_id, 'Namkeen Mix', '200g', 90, 120),
    (v_org_id, v_snacks_id, 'Potato Chips', '1pack', 50, 65),
    (v_org_id, v_snacks_id, 'Rusk', '1pack', 100, 130);

  -- Personal Care
  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_personal_id, 'Toothpaste', '150g', 130, 160),
    (v_org_id, v_personal_id, 'Shampoo', '200ml', 220, 260),
    (v_org_id, v_personal_id, 'Hair Oil', '200ml', 180, 220),
    (v_org_id, v_personal_id, 'Matches', '1pack', 15, 20);
end $$;