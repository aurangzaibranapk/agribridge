-- Migration 481: Bridge AI Daily Briefing feature nav mein add karo
-- Testing + Live dono par apply ho chuki hai (direct MCP se).

INSERT INTO features (key, label, route, icon, is_sensitive, is_active, description)
VALUES (
  'bridge-ai.daily-briefing',
  'Daily Briefing',
  '/admin/bridge-ai/daily-briefing',
  'BarChart2',
  false,
  true,
  'Har roz ka aik safhe par saara jaiza — bikri, stock, staff aur pending approvals.'
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  icon  = EXCLUDED.icon,
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
VALUES ('ai', 'bridge-ai.daily-briefing', 25, 'Operations', 1)
ON CONFLICT (dashboard_key, feature_key) DO UPDATE SET
  sort_order = 25,
  section = 'Operations';

INSERT INTO feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
VALUES (
  'bridge-ai.daily-briefing',
  'rm',
  'Roz subah business ka saara haal ek jagah dekhna: aaj ki bikri, stock alert, staff performance aur pending approvals.',
  'Owner, Admin, Manager',
  'Roz subah login karte hi ya din mein kisi bhi waqt jab overview chahiye.',
  ARRAY[
    'Bridge AI → Daily Briefing click karein.',
    'Tiles mein aaj ki bikri aur top branch dekhein.',
    'Stock Alert mein urgent products ke naam note karein.',
    'Pending approvals ki fehrist dekhein.'
  ],
  'Agar stock urgent dikhe to Inventory → Reorder par jayein. Pending approvals ke liye Bridge AI Action Requests khol lein.',
  ARRAY[
    'Ye safha live data dikhata hai — refresh karne par numbers update ho sakte hain.'
  ]
)
ON CONFLICT (feature_key, lang) DO UPDATE SET
  purpose   = EXCLUDED.purpose,
  who_uses  = EXCLUDED.who_uses,
  when_use  = EXCLUDED.when_use,
  how_steps = EXCLUDED.how_steps,
  next_step = EXCLUDED.next_step,
  mistakes  = EXCLUDED.mistakes;
