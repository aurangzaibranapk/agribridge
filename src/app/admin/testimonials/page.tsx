import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteTestimonial } from "@/actions/cms";
import { NewTestimonialForm } from "@/app/admin/testimonials/new-testimonial-form";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const supabase = createClient();
  const { data: items } = await supabase.from("testimonials").select("*").order("display_order");

  return (
    <div>
      <PageHeader title="Testimonials" description="Shown on the homepage and the /testimonials page" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!items || items.length === 0 ? (
            <EmptyState title="No testimonials yet" />
          ) : (
            <div className="space-y-3">
              {items.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white">{t.customer_name} <span className="text-xs text-surface-400">— {t.location}</span></p>
                    <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">&ldquo;{t.quote}&rdquo;</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={t.is_published ? "green" : "gray"}>{t.is_published ? "Published" : "Hidden"}</Badge>
                    <DeleteButton id={t.id} action={deleteTestimonial} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <NewTestimonialForm />
      </div>
    </div>
  );
}
