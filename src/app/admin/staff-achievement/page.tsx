import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { AchievementClient } from "./achievement-client";

export const dynamic = "force-dynamic";

export default async function StaffAchievementPage() {
  const supabase = createClient();

  const sb = supabase as any;
  const [{ data: staffRaw }, { data: targets }] = await Promise.all([
    sb.rpc("fn_hr_staff_directory"),
    sb.from("staff_targets").select("*").order("created_at", { ascending: false }),
  ]);

  const staff = (staffRaw ?? []).map((s: any) => ({
    id: s.profile_id as string,
    name: (s.full_name ?? "—") as string,
    designation: (s.designation ?? "") as string,
    department: (s.department_label ?? s.department_key ?? "") as string,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Achievement System"
        description="Har staff member ke liye targets aur goals set karein — progress yahan nazar aayegi."
      />
      <AchievementClient staff={staff} targets={targets ?? []} />
    </div>
  );
}
