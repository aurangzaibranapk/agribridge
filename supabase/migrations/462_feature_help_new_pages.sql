-- Migration 462: 3 naye features register + feature_help add karein
-- Product Cycles, Stock Value Report, ERP ka Naqsha

-- Step 1: features table mein register
INSERT INTO features (key, label, label_en, route, icon, is_active)
VALUES
  ('product-cycles',      'Product Cycles (Shops)',  'Product Cycles (Shops)',  '/admin/product-cycles',          'RefreshCw',  true),
  ('reports.stock-value', 'Stock Value Report',      'Stock Value Report',      '/admin/reports/stock-value',     'LineChart',  true),
  ('erp-directory',       'ERP ka Naqsha',           'ERP Directory',           '/admin/erp-directory',           'LayoutGrid', true)
ON CONFLICT (key) DO NOTHING;

-- Step 2: feature_help entries
INSERT INTO feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
VALUES

-- Product Cycles (rm)
('product-cycles', 'rm',
  'Dukan ke products ko chakkar dena aur roz ek choti batch ki ginti karna taake stock ka hisaab theek rahe.',
  'Manager, Owner',
  'Jab naye hafta mein dukan ka layout set karna ho, ya roz subah ginti ka time ho.',
  ARRAY[
    '"Product Cycles" kholein.',
    '"Shop Rotation" tab mein har dukan ke products upar-neeche karo — jo zyada bikta hai wo upar.',
    '"Daily Count" tab mein "Aaj ki Ginti Shuru Karo" dabaen — system aaj ka batch khud deta hai.',
    'Har product ke saamne gini hui miqdar likhein.',
    '"Submit" dabaen — farq system mein darj ho jata hai.'
  ],
  'Submit ke baad "Stock ka Khata" mein farq check karein.',
  ARRAY['Bina submit kiye safha band karna — ginti zaya ho jati hai. Submit karne ke baad hi record banta hai.']),

-- Product Cycles (en)
('product-cycles', 'en',
  'Rotate shop products by sales priority and run a daily mini stock-count batch to keep inventory accurate.',
  'Manager, Owner',
  'Weekly for rotation; daily for cycle count.',
  ARRAY[
    'Open Product Cycles.',
    'Rotation tab: reorder products per shop — bestsellers first.',
    'Daily Count tab: tap Start Today Session. System picks the batch.',
    'Enter counted qty for each product.',
    'Submit — differences are recorded.'
  ],
  'Check Stock Ledger for any variance after submit.',
  ARRAY['Closing the page without submitting loses all counted quantities.']),

-- Stock Value Report (rm)
('reports.stock-value', 'rm',
  'Poori stock ki rupaye mein qeemat dikhata hai — category aur warehouse ke hisaab se — taake maloom ho kahan kitna paisa phansa hai.',
  'Owner, Manager',
  'Mahine ke aakhir mein ya jab bhi investor ko ya bank ko stock ki total qeemat batani ho.',
  ARRAY[
    '"Stock Value Report" kholein.',
    'Warehouse ya category filter lagaen (agar chahein).',
    'Table mein har category ki miqdar aur qeemat dikhti hai.',
    'Kisi category ki row par click karo — us ke products ka detail khulta hai.'
  ],
  'Zyada qeemat wali category ke liye purchase order kam karo ya stock cycle tez karo.',
  ARRAY['Ye report sale rate se hisaab lagati hai, original cost se nahi. Asli munaafa ke liye P&L dekhen.']),

-- Stock Value Report (en)
('reports.stock-value', 'en',
  'Shows total stock value in rupees broken down by category and warehouse — so you know where capital is tied up.',
  'Owner, Manager',
  'Month-end or when presenting stock value to investors or auditors.',
  ARRAY[
    'Open Stock Value Report.',
    'Filter by warehouse or category as needed.',
    'Category table shows qty and value.',
    'Click any category row to see individual product breakdown.'
  ],
  'For high-value categories, speed up the sales cycle or review reorder levels.',
  ARRAY['Values are based on sale rate, not purchase cost. Use P&L for true profit analysis.']),

-- ERP ka Naqsha (rm)
('erp-directory', 'rm',
  'Poore ERP ka ek jagah naqsha — har feature ka naam, maqsad, aur us tak ka seedha raasta.',
  'Sab log',
  'Jab koi naya staff member aaye, ya koi feature dhoondna ho jo menu mein nazar nahi aa raha.',
  ARRAY[
    '"ERP ka Naqsha" kholein.',
    'Search bar mein kaam ka naam likhein (jaise "doodh" ya "payment").',
    'Ya upar section filter se apna department chunein.',
    'Feature mil jaye to us ke naam par click karo — seedha us safhe par pahunch jao.'
  ],
  'Naye feature ka naam suggest karna ho to Manager ko batao taake naqsha update ho.',
  ARRAY['Ye sirf raasta dikhata hai — kaam is safhe se nahi hota, raasta yahan milta hai.']),

-- ERP ka Naqsha (en)
('erp-directory', 'en',
  'A single-page map of every ERP feature with its name, purpose, and direct link.',
  'Everyone',
  'Onboarding new staff, or finding any feature quickly.',
  ARRAY[
    'Open ERP ka Naqsha.',
    'Type a keyword in the search bar (e.g. "milk" or "salary").',
    'Or filter by section using the top chips.',
    'Click any feature row to go directly to that page.'
  ],
  'If a feature is missing, notify the manager to have the directory updated.',
  ARRAY['This is a navigation aid only — actual work happens on the linked pages.']);
