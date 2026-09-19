import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteFaq } from "@/actions/cms";
import { NewFaqForm } from "@/app/admin/faqs/new-faq-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: items } = await supabase.from("faqs").select("*").order("category").order("display_order");

  return (
    <div>
      <PageHeader title={t("at_faq", lang)} description="Shown on the public /faq page, grouped by category" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title={t("at_no_faqs", lang)} />
          ) : (
            <div className="space-y-3">
              {items.map((f) => (
                <div key={f.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge tone="blue">{f.category}</Badge>
                    <div className="flex items-center gap-2">
                      <Badge tone={f.is_published ? "green" : "gray"}>{f.is_published ? "Published" : "Hidden"}</Badge>
                      <DeleteButton id={f.id} action={deleteFaq} />
                    </div>
                  </div>
                  <p className="font-medium text-surface-900 dark:text-white">{f.question}</p>
                  <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{f.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <NewFaqForm />
      </div>
    </div>
  );
}
