-- Carrier (darmiyan wala) ki tasdeeq ka record.
--
-- Jab carrier Anwar se cash le kar Finance ke paas pohonchata hai, to
-- carrier pehle apne login se slip par "Main ne le liya" sign karta hai.
-- Phir Finance apni taraf se confirm karta hai. Ye do column us beech
-- wali tasdeeq ko pakarte hain -- ek naam, ek waqt.

ALTER TABLE cash_handovers
  ADD COLUMN IF NOT EXISTS carrier_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS carrier_confirmed_by  UUID REFERENCES profiles(id);

COMMENT ON COLUMN cash_handovers.carrier_confirmed_at IS
  'Jab carrier ne slip par "Main ne le liya" kiya';
COMMENT ON COLUMN cash_handovers.carrier_confirmed_by IS
  'Wo profile jis ne carrier wali tasdeeq ki (carrier_profile_id se milna chahiye)';
