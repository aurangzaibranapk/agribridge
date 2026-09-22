import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { UNRESTRICTED_ROLES } from "@/lib/departments";

export const dynamic = "force-dynamic";

/** Team ki training: kis ne kaun sa module poora kiya (D). */
export default async function AcademyTeamPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me || ![...UNRESTRICTED_ROLES, "manager", "hr"].includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("ac_team", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }
  const service = createServiceClient();
  const [{ data: staff }, { data: modules }, { data: progress }] = await Promise.all([
    service.from("profiles").select("id, full_name, role, training_mode").eq("is_active", true).order("full_name"),
    service.from("training_modules").select("key, title, department_key, sort_order").eq("is_active", true).order("sort_order"),
    service.from("staff_training_progress").select("profile_id, module_key, status"),
  ]);
  const doneSet = new Set((progress ?? []).filter((p) => p.status === "done").map((p) => `${p.profile_id}|${p.module_key}`));
  const started = new Set((progress ?? []).map((p) => `${p.profile_id}|${p.module_key}`));

  return (
    <div>
      <PageHeader title={t("ac_team", lang)} description={t("ac_team_desc", lang)} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
              <th className="py-2 pr-3">{t("ac_staff", lang)}</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">{t("ac_training_mode", lang)}</th>
              {(modules ?? []).map((m) => (
                <th key={m.key} className="py-2 pr-3 text-center">{m.title}</th>
              ))}
              <th className="py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => {
              const total = (modules ?? []).length;
              const n = (modules ?? []).filter((m) => doneSet.has(`${s.id}|${m.key}`)).length;
              return (
                <tr key={s.id} className="border-b border-surface-100">
                  <td className="py-2 pr-3 font-medium">{s.full_name}</td>
                  <td className="py-2 pr-3 text-surface-500">{s.role}</td>
                  <td className="py-2 pr-3 text-xs">{s.training_mode ? <span className="text-amber-700">ON</span> : <span className="text-surface-400">off</span>}</td>
                  {(modules ?? []).map((m) => {
                    const k = `${s.id}|${m.key}`;
                    return (
                      <td key={m.key} className="py-2 pr-3 text-center">
                        {doneSet.has(k) ? <span className="text-emerald-600">✓</span> : started.has(k) ? <span className="text-amber-600">…</span> : <span className="text-surface-300">·</span>}
                      </td>
                    );
                  })}
                  <td className="py-2 text-right tabular-nums">{total ? Math.round((n / total) * 100) : 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
