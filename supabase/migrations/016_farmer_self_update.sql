-- Farmer Portal profile page (src/app/portal/profile) lets a logged-in
-- farmer fill in their own remaining details (nickname, backup phone,
-- land & animal details, member photo, CNIC images) after registration.
-- Migration 010 only ever granted farmers SELECT + INSERT on their own
-- row — there was no UPDATE policy, so this would otherwise be silently
-- rejected by RLS the moment a farmer tried to save their profile.
--
-- Column-level restriction (so a farmer can never set is_verified,
-- milk_financing_enabled, kms_id, farmer_code, etc. on themselves) is
-- enforced in application code, not here: the updateFarmerProfile server
-- action only ever writes the specific self-service columns, never the
-- staff-only ones. This mirrors how registerFarmer already controls
-- exactly which columns get set on insert.
create policy farmer_self_update on farmers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
