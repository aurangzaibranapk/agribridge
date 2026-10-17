-- 531: HR self-approval RLS guards
-- Covers: leave self-approval, attendance self-insert, HR own staff_details
-- IMPORTANT: Live DB par apply NAHI kiya.
-- Pehle testing DB pe apply karo, verify karo, phir Owner approval ke baad live.

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_details ENABLE ROW LEVEL SECURITY;

-- S1: Leave — staff sirf pending insert kar sakta hai, khud approve nahi
DROP POLICY IF EXISTS leave_own_insert ON public.leave_requests;
CREATE POLICY leave_own_insert ON public.leave_requests
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND COALESCE(status, 'pending') = 'pending'
  );

DROP POLICY IF EXISTS leave_own_update ON public.leave_requests;
CREATE POLICY leave_own_update ON public.leave_requests
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (
    profile_id = auth.uid()
    AND status IN ('pending', 'cancelled')
  );

-- S2: Attendance self-insert — sirf aaj ki date (PKT)
DROP POLICY IF EXISTS attendance_self_insert ON public.attendance;
CREATE POLICY attendance_self_insert ON public.attendance
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND attendance_date = (now() AT TIME ZONE 'Asia/Karachi')::date
  );

-- S4: HR / Admin apna staff_details record khud nahi badal sakta
DROP POLICY IF EXISTS staff_details_write_hr ON public.staff_details;
CREATE POLICY staff_details_write_hr ON public.staff_details
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('hr', 'admin', 'owner', 'super_admin')
        AND p.is_active = true
        AND p.id <> staff_details.profile_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('hr', 'admin', 'owner', 'super_admin')
        AND p.is_active = true
        AND p.id <> staff_details.profile_id
    )
  );

COMMENT ON POLICY leave_own_insert ON public.leave_requests IS 'Staff can only insert own leave as pending (531).';
COMMENT ON POLICY attendance_self_insert ON public.attendance IS 'Staff can only insert own attendance for today PKT (531).';
COMMENT ON POLICY staff_details_write_hr ON public.staff_details IS 'HR/Admin cannot edit own staff_details (531).';
