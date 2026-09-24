import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/server";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

const HR_ROLES = ["hr", "admin", "owner", "super_admin"];

/**
 * Team aur reporting.
 *
 * Ye safha poore nizam ki reeRh ki haddi hai: manager sirf apni team ka
 * faisla kar sakta hai, aur "apni team" ka matlab yahin se banta hai.
 * Jab tak kisi ka afsar darj nahi, us ki har darkhwast HR ke paas jati
 * hai -- ye khamoshi se rukti nahi, safhe par saaf likha hai.
 */
export default async function TeamPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  const canEdit = !!me?.is_active && HR_ROLES.includes(me.role);

  const [{ data: dir, error: dirErr }, { data: departments }, { data: branches }] = await Promise.all([
    supabase.rpc("fn_hr_staff_directory"),
    supabase.from("departments").select("key, label").eq("is_active", true).order("sort_order"),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (dirErr) {
    return (
      <div>
        <PageHeader title={t("hrt_title", lang)} description={t("hrt_subtitle", lang)} />
        <Card>
          <p className="text-sm text-red-700">{dirErr.message}</p>
        </Card>
      </div>
    );
  }

  const rows = (dir ?? []).map((d) => ({
    id: d.profile_id,
    name: d.full_name ?? "—",
    role: d.role ?? "—",
    designation: d.designation,
    departmentKey: d.department_key,
    departmentLabel: d.department_label,
    branchId: d.branch_id,
    branchName: d.branch_name,
    employmentType: d.employment_type ?? "permanent",
    reportsTo: d.reports_to,
    reportsToName: d.reports_to_name,
    directReports: d.direct_reports ?? 0,
  }));

  return (
    <div>
      <PageHeader title={t("hrt_title", lang)} description={t("hrt_subtitle", lang)} />
      <TeamClient
        lang={lang}
        canEdit={canEdit}
        rows={rows}
        departments={(departments ?? []).map((d) => ({ key: d.key, label: d.label }))}
        branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
