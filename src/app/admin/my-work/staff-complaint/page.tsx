import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffComplaintForm } from "@/components/support/complaint-queue";
import { isStaffRole } from "@/lib/utils/roles";

export const dynamic = "force-dynamic";

export default async function StaffComplaintPage() {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await client.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !isStaffRole(me.role)) redirect("/login");
  return (
    <main className="min-h-screen bg-[#f3f6fb] p-6">
      <StaffComplaintForm />
    </main>
  );
}
