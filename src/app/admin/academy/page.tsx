import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { departmentForRole, UNRESTRICTED_ROLES } from "@/lib/departments";
import { ModuleCard } from "./module-card";

export const dynamic = "force-dynamic";

/**
 * AgriBridge Academy (D). Apne department ka module pehle, phir baqi.
 * Har module: video (malik ki), qadam, demo try karein, poora ho gaya.
 */
export default async function AcademyPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");
  const dept = departmentForRole(me.role);

  const [{ data: modules }, { data: progress }] = await Promise.all([
    supabase.from("training_modules").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("staff_training_progress").select("module_key, status, completed_at").eq("profile_id", user.id),
  ]);
  const prog = new Map((progress ?? []).map((p) => [p.module_key, p]));
  const mine = (modules ?? []).filter((m) => m.department_key === dept?.key);
  const others = (modules ?? []).filter((m) => m.department_key !== dept?.key);
  const done = (modules ?? []).filter((m) => prog.get(m.key)?.status === "done").length;
  const canSeeTeam = [...UNRESTRICTED_ROLES, "manager", "hr"].includes(me.role);

  const title = (m: { title: string; title_en: string | null; title_ur: string | null }) =>
    lang === "en" ? m.title_en || m.title : lang === "ur" ? m.title_ur || m.title : m.title;

  return (
    <div>
      <PageHeader
        title={t("ac_title", lang)}
        description={t("ac_desc", lang).replace("{done}", String(done)).replace("{total}", String((modules ?? []).length))}
        actions={canSeeTeam ? <Link href="/admin/academy/team" className="text-sm font-medium text-brand-600 underline">{t("ac_team", lang)}</Link> : undefined}
      />
      {mine.length > 0 && (
        <>
          <h2 className="mb-2 mt-2 text-sm font-semibold text-surface-700 dark:text-surface-300">
            {t("ac_yours", lang)} <Badge tone="blue">{dept?.label}</Badge>
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {mine.map((m) => (
              <ModuleCard key={m.key} lang={lang} moduleKey={m.key} title={title(m)} summary={m.summary} steps={m.steps ?? []} video={m.video_url} tryRoute={m.try_route} status={prog.get(m.key)?.status ?? null} />
            ))}
          </div>
        </>
      )}
      <h2 className="mb-2 mt-5 text-sm font-semibold text-surface-700 dark:text-surface-300">{t("ac_all", lang)}</h2>
      {others.length === 0 && mine.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-500">{t("ac_none", lang)}</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {others.map((m) => (
            <ModuleCard key={m.key} lang={lang} moduleKey={m.key} title={title(m)} summary={m.summary} steps={m.steps ?? []} video={m.video_url} tryRoute={m.try_route} status={prog.get(m.key)?.status ?? null} compact />
          ))}
        </div>
      )}
    </div>
  );
}
