import { createClient } from "@/lib/supabase/server";
import { VacancyList } from "./vacancy-list";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: rawVacancies } = await supabase
    .from("job_vacancies")
    .select("id, title, designation, description, requirements, branches(name)")
    .eq("is_open", true)
    .order("created_at", { ascending: false });

  const vacancies = (rawVacancies ?? []).map((v: any) => ({
    id: v.id,
    title: v.title,
    designation: v.designation,
    description: v.description,
    requirements: v.requirements,
    branch_name: Array.isArray(v.branches) ? v.branches[0]?.name : v.branches?.name,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold text-surface-900">{t("sp_careers_title", lang)}</h1>
      <p className="mt-2 text-surface-500">{t("sp_careers_lead", lang)}</p>
      <div className="mt-8">
        <VacancyList vacancies={vacancies} />
      </div>
    </div>
  );
}