import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { VacancyForm } from "./vacancy-form";
import { VacancyToggle } from "./vacancy-toggle";
import { DeleteVacancyButton } from "./delete-vacancy-button";

export const dynamic = "force-dynamic";

export default async function AdminJobVacanciesPage() {
  const supabase = createClient();
  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
  const { data: rawVacancies } = await supabase
    .from("job_vacancies")
    .select("id, title, designation, is_open, created_at, branches(name)")
    .order("created_at", { ascending: false });
  const { data: applicationCounts } = await supabase.from("job_applications").select("vacancy_id");
  const countMap = new Map<string, number>();
  (applicationCounts ?? []).forEach((a) => countMap.set(a.vacancy_id, (countMap.get(a.vacancy_id) ?? 0) + 1));
  const vacancies = (rawVacancies ?? []).map((v: any) => ({
    id: v.id,
    title: v.title,
    designation: v.designation,
    is_open: v.is_open,
    branch_name: Array.isArray(v.branches) ? v.branches[0]?.name : v.branches?.name,
    applicationCount: countMap.get(v.id) ?? 0,
  }));
  return (
    <div>
      <PageHeader title="Job Vacancies" description="Post open positions - they'll show up on the public Careers page" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {vacancies.length === 0 ? (
            <EmptyState title="No vacancies posted yet" />
          ) : (
            <div className="space-y-2">
              {vacancies.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white">{v.title}</p>
                    <p className="text-xs text-surface-500">{v.branch_name ?? "Any Shop"} - {v.applicationCount} applications</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <VacancyToggle vacancyId={v.id} isOpen={v.is_open} />
                    {v.applicationCount === 0 && <DeleteVacancyButton vacancyId={v.id} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <VacancyForm branches={branches ?? []} />
      </div>
    </div>
  );
}