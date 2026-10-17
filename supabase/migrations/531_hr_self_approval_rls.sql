-- 531: HR self-approval RLS guards (leave, attendance, staff_details)
-- Live DB par apply NAHI kiya. Owner approval ke baad testing pe, phir live.

-- S1: Leave — staff apni chhutti khud approved nahi likh sakta
DROP POLICY IF EXISTS leave_own_insert ON public.leave_requests;
CREATE POLICY leave_own_insert ON public.leave_requests
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS leave_own_update ON public.leave_requests;
CREATE POLICY leave_own_update ON public.leave_requests
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    AND status IN ('pending', 'cancelled')
  );

-- S2: Attendance — staff apni row sirf aaj ki, aur sirf via controlled path
-- (Full insert guard already mostly in app; strengthen DB)
DROP POLICY IF EXISTS attendance_self_insert ON public.attendance;
CREATE POLICY attendance_self_insert ON public.attendance
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND attendance_date = (now() AT TIME ZONE 'Asia/Karachi')::date
  );

-- S4: HR apna staff record khud nahi badal sakta
DROP POLICY IF EXISTS staff_details_write_hr ON public.staff_details;
CREATE POLICY staff_details_write_hr ON public.staff_details
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('hr', 'admin', 'owner', 'super_admin')
        AND p.is_active
        AND p.id <> staff_details.profile_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('hr', 'admin', 'owner', 'super_admin')
        AND p.is_active
        AND p.id <> staff_details.profile_id
    )
  );
