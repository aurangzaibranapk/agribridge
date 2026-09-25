-- cycle_count_settings par RLS policies (pehle sirf UNIQUE constraint tha, policies nahi thin)
CREATE POLICY "cycle_count_settings_select"
  ON cycle_count_settings FOR SELECT
  USING (fn_is_any_staff());

CREATE POLICY "cycle_count_settings_insert"
  ON cycle_count_settings FOR INSERT
  WITH CHECK (fn_is_any_staff());

CREATE POLICY "cycle_count_settings_update"
  ON cycle_count_settings FOR UPDATE
  USING (fn_is_any_staff());

CREATE POLICY "cycle_count_settings_delete"
  ON cycle_count_settings FOR DELETE
  USING (fn_is_any_staff());
