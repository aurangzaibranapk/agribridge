-- AgriBridge — Kiryana Store complete category catalogue
-- Safe additive seed: existing categories, products and stock are preserved.

do $$
declare
  category_name text;
begin
  foreach category_name in array array[
    'Aata & Flour',
    'Rice',
    'Daalain',
    'Spices & Masalay',
    'Salt',
    'Sugar & Sweeteners',
    'Ghee & Cooking Oil',
    'Tea & Coffee',
    'Milk & Dairy',
    'Eggs',
    'Cold Drinks',
    'Juices',
    'Mineral Water',
    'Energy Drinks',
    'Biscuits',
    'Bakery Items',
    'Chocolates',
    'Toffees & Candies',
    'Chips & Snacks',
    'Namkeen',
    'Noodles & Pasta',
    'Sauces & Ketchup',
    'Pickles & Achar',
    'Jam & Jelly',
    'Dry Fruits',
    'Seeds',
    'Baking Items',
    'Frozen Foods',
    'Frozen Vegetables',
    'Frozen Snacks',
    'Canned Foods',
    'Baby Food',
    'Baby Care',
    'Personal Care',
    'Shampoo & Hair Care',
    'Toothpaste & Oral Care',
    'Soap & Body Care',
    'Detergents',
    'Dishwashing Items',
    'Floor & Toilet Cleaners',
    'Tissue & Paper Products',
    'Mosquito & Pest Control',
    'Kitchen Items',
    'Plastic Items',
    'Disposable Items',
    'Match Box & Lighters',
    'Pet Food',
    'Stationery',
    'Household Items',
    'Grocery Miscellaneous'
  ] loop
    insert into public.categories (name, category_kind)
    select category_name, 'karyana'
    where not exists (
      select 1 from public.categories c where lower(trim(c.name)) = lower(trim(category_name))
    );
  end loop;
end $$;

comment on table public.categories is
  'Product categories. Migration 508 adds the complete Kiryana Store catalogue without changing existing products or stock.';

