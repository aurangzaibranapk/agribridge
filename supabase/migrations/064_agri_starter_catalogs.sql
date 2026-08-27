-- =====================================================================
-- AgriBridge — Migration 064: Fertilizer/Pesticide/Seeds/Wanda Starter Catalogs
-- =====================================================================
-- Each is its own TOP-LEVEL category (not under Grocery) so they never
-- mix on the Grocery page. Same pattern as Migration 063.

do $$
declare
  v_org_id uuid;
  v_fert_cat_id uuid;
  v_pest_cat_id uuid;
  v_seed_cat_id uuid;
  v_wanda_cat_id uuid;
  v_fert_urea_id uuid;
  v_fert_dap_id uuid;
  v_fert_potash_id uuid;
  v_fert_micro_id uuid;
  v_pest_insect_id uuid;
  v_pest_herb_id uuid;
  v_pest_fungi_id uuid;
  v_seed_field_id uuid;
  v_seed_veg_id uuid;
  v_wanda_cattle_id uuid;
  v_wanda_poultry_id uuid;
begin
  select id into v_org_id from organizations limit 1;

  -- ===== FERTILIZER =====
  select id into v_fert_cat_id from categories where name = 'Fertilizer' limit 1;
  if v_fert_cat_id is null then
    insert into categories (name) values ('Fertilizer') returning id into v_fert_cat_id;
  end if;
  insert into categories (name, parent_category_id) values ('Nitrogen (Urea)', v_fert_cat_id) returning id into v_fert_urea_id;
  insert into categories (name, parent_category_id) values ('Phosphate (DAP/SSP)', v_fert_cat_id) returning id into v_fert_dap_id;
  insert into categories (name, parent_category_id) values ('Potash (MOP)', v_fert_cat_id) returning id into v_fert_potash_id;
  insert into categories (name, parent_category_id) values ('Micronutrients', v_fert_cat_id) returning id into v_fert_micro_id;

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_fert_urea_id, 'Urea (46% N)', '50kg bag', 3200, 3500),
    (v_org_id, v_fert_dap_id, 'DAP (18-46-0)', '50kg bag', 11500, 12200),
    (v_org_id, v_fert_dap_id, 'SSP (Single Super Phosphate)', '50kg bag', 2600, 2900),
    (v_org_id, v_fert_dap_id, 'NP (23-23-0)', '50kg bag', 6800, 7300),
    (v_org_id, v_fert_potash_id, 'MOP (Muriate of Potash)', '50kg bag', 8200, 8700),
    (v_org_id, v_fert_potash_id, 'NPK (Compound)', '50kg bag', 9500, 10200),
    (v_org_id, v_fert_micro_id, 'Zinc Sulphate', '25kg bag', 4200, 4600),
    (v_org_id, v_fert_micro_id, 'Boron', '1kg', 800, 950),
    (v_org_id, v_fert_micro_id, 'Zabardast Growth Booster (Foliar)', '1L', 1200, 1400);

  -- ===== PESTICIDE =====
  select id into v_pest_cat_id from categories where name = 'Pesticide' limit 1;
  if v_pest_cat_id is null then
    insert into categories (name) values ('Pesticide') returning id into v_pest_cat_id;
  end if;
  insert into categories (name, parent_category_id) values ('Insecticides', v_pest_cat_id) returning id into v_pest_insect_id;
  insert into categories (name, parent_category_id) values ('Herbicides/Weedicides', v_pest_cat_id) returning id into v_pest_herb_id;
  insert into categories (name, parent_category_id) values ('Fungicides', v_pest_cat_id) returning id into v_pest_fungi_id;

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_pest_insect_id, 'Imidacloprid 17.8% SL', '250ml', 950, 1100),
    (v_org_id, v_pest_insect_id, 'Cypermethrin 10% EC', '1L', 1100, 1300),
    (v_org_id, v_pest_insect_id, 'Chlorpyrifos 40% EC', '1L', 1250, 1450),
    (v_org_id, v_pest_herb_id, 'Glyphosate 41% SL', '1L', 900, 1050),
    (v_org_id, v_pest_herb_id, 'Atrazine 50% WP', '1kg', 1000, 1150),
    (v_org_id, v_pest_fungi_id, 'Mancozeb 80% WP', '1kg', 850, 1000),
    (v_org_id, v_pest_fungi_id, 'Copper Oxychloride 50% WP', '1kg', 780, 920);

  -- ===== SEEDS =====
  select id into v_seed_cat_id from categories where name = 'Seeds' limit 1;
  if v_seed_cat_id is null then
    insert into categories (name) values ('Seeds') returning id into v_seed_cat_id;
  end if;
  insert into categories (name, parent_category_id) values ('Field Crop Seeds', v_seed_cat_id) returning id into v_seed_field_id;
  insert into categories (name, parent_category_id) values ('Vegetable Seeds', v_seed_cat_id) returning id into v_seed_veg_id;

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_seed_field_id, 'Wheat Seed (Certified)', '50kg bag', 5200, 5600),
    (v_org_id, v_seed_field_id, 'Rice Seed (Basmati 515)', '25kg bag', 3800, 4200),
    (v_org_id, v_seed_field_id, 'Cotton Seed (BT)', '20kg bag', 4500, 4900),
    (v_org_id, v_seed_field_id, 'Maize Seed (Hybrid)', '10kg bag', 6500, 7000),
    (v_org_id, v_seed_veg_id, 'Tomato Seed', '10g packet', 350, 420),
    (v_org_id, v_seed_veg_id, 'Onion Seed', '100g packet', 900, 1050),
    (v_org_id, v_seed_veg_id, 'Chilli Seed', '10g packet', 400, 480);

  -- ===== WANDA (Animal Feed) =====
  select id into v_wanda_cat_id from categories where name = 'Wanda' limit 1;
  if v_wanda_cat_id is null then
    insert into categories (name) values ('Wanda') returning id into v_wanda_cat_id;
  end if;
  insert into categories (name, parent_category_id) values ('Cattle/Dairy Feed', v_wanda_cat_id) returning id into v_wanda_cattle_id;
  insert into categories (name, parent_category_id) values ('Poultry Feed', v_wanda_cat_id) returning id into v_wanda_poultry_id;

  insert into products (organization_id, category_id, name, pack_size, purchase_price, selling_price) values
    (v_org_id, v_wanda_cattle_id, 'Dairy Wanda (Milk Booster)', '50kg bag', 4200, 4600),
    (v_org_id, v_wanda_cattle_id, 'Calf Starter Feed', '25kg bag', 2600, 2900),
    (v_org_id, v_wanda_cattle_id, 'Mineral Block/Salt Lick', '5kg', 600, 750),
    (v_org_id, v_wanda_poultry_id, 'Broiler Starter Feed', '50kg bag', 8500, 9100),
    (v_org_id, v_wanda_poultry_id, 'Layer Feed', '50kg bag', 7800, 8400);
end $$;