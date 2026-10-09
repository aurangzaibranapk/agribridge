-- 519: Grain entry -- "Stock mein poora (gross) wazan daalein; katoti sirf
-- kisan ki adaigi se" (per-entry option, default band).
--
-- Boss (9 Oct 2026): Rana Ghazanfar Abbas ki gandum -- godam mein poore
-- 20,000 kg aaye, kisan ko 1 kg fi bori katoti ke baad 19,600 kg ki raqam.
--
-- SIRF izafa:
--   * grain_procurement_entries.stock_weight_kg (nullable). Sirf us entry par
--     bharta hai jis par option laga ho; purani rows NULL rehti hain.
--   * v_grain_warehouse_stock ka "aaya kg" ab coalesce(stock_weight_kg,
--     weight_kg) -- NULL par bilkul wohi purana hisaab. Columns, naam aur
--     tarteeb wohi; CREATE OR REPLACE se ijazatein bhi wohi rehti hain.
-- Koi purani row ya data nahi badla.

alter table public.grain_procurement_entries add column if not exists stock_weight_kg numeric;
alter table public.grain_procurement_entries drop constraint if exists grain_entries_stock_weight_check;
alter table public.grain_procurement_entries add constraint grain_entries_stock_weight_check
  check (stock_weight_kg is null or stock_weight_kg > 0);
comment on column public.grain_procurement_entries.stock_weight_kg is
  'Godam (stock) mein gaya wazan jab "poora (gross) wazan" option laga ho. NULL = stock mein saaf wazan (weight_kg). Kisan ki adaigi hamesha weight_kg par.';

create or replace view public.v_grain_warehouse_stock as
 SELECT w.id AS warehouse_id,
    w.name AS warehouse_name,
    t.grain_type,
    COALESCE(inn.kg, (0)::numeric) AS aaya_kg,
    COALESCE("out".kg, (0)::numeric) AS gaya_kg,
    (COALESCE(inn.kg, (0)::numeric) - COALESCE("out".kg, (0)::numeric)) AS maujood_kg,
    COALESCE(inn.raqam, (0)::numeric) AS kharidari_ki_raqam,
        CASE
            WHEN (COALESCE(inn.kg, (0)::numeric) > (0)::numeric) THEN round((COALESCE(inn.raqam, (0)::numeric) / inn.kg), 2)
            ELSE NULL::numeric
        END AS aausat_lagat_fi_kg,
        CASE
            WHEN (COALESCE(inn.kg, (0)::numeric) > (0)::numeric) THEN round(((COALESCE(inn.kg, (0)::numeric) - COALESCE("out".kg, (0)::numeric)) * (COALESCE(inn.raqam, (0)::numeric) / inn.kg)), 2)
            ELSE (0)::numeric
        END AS maujood_ki_lagat
   FROM (((warehouses w
     CROSS JOIN ( SELECT unnest(ARRAY['wheat'::text, 'rice'::text, 'maize'::text]) AS grain_type) t)
     LEFT JOIN LATERAL ( SELECT sum(COALESCE(e.stock_weight_kg, e.weight_kg)) AS kg,
            sum(e.total_amount) AS raqam
           FROM grain_procurement_entries e
          WHERE ((e.warehouse_id = w.id) AND ((e.grain_type)::text = t.grain_type))) inn ON (true))
     LEFT JOIN LATERAL ( SELECT sum(s.quantity_kg) AS kg
           FROM grain_sales s
          WHERE ((s.warehouse_id = w.id) AND (s.grain_type = t.grain_type))) "out" ON (true))
  WHERE (fn_is_any_staff() AND ((COALESCE(inn.kg, (0)::numeric) <> (0)::numeric) OR (COALESCE("out".kg, (0)::numeric) <> (0)::numeric)));
