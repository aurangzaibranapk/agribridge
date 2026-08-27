import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteHeroSlide } from "@/actions/cms";
import { NewHeroSlideForm } from "@/app/admin/hero-slides/new-hero-slide-form";
import { EditHeroSlideButton } from "@/app/admin/hero-slides/edit-hero-slide-modal";

export const dynamic = "force-dynamic";

export default async function AdminHeroSlidesPage() {
  const supabase = createClient();
  const { data: slides } = await supabase.from("hero_slides").select("*").order("display_order");
  return (
    <div>
      <PageHeader title="Hero Slider" description="Homepage hero slides (leave empty to show the default static hero)" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!slides || slides.length === 0 ? (
            <EmptyState title="No slides yet" description="The homepage falls back to its default static hero until at least one slide is added." />
          ) : (
            <div className="space-y-3">
              {slides.map((s) => (
                <div key={s.id} className="flex items-center gap-4 rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">Order {s.display_order}</span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <img src={s.image_url} alt="Desktop" title="Desktop Image" className="h-16 w-24 rounded-lg object-cover" />
                    {s.mobile_image_url && (
                      <img src={s.mobile_image_url} alt="Mobile" title="Mobile Image" className="h-16 w-10 rounded-lg object-cover" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-surface-900 dark:text-white">{s.headline}</p>
                    <p className="text-xs text-surface-400 dark:text-surface-500">{s.subheadline}</p>
                    {!s.mobile_image_url && <p className="text-[11px] text-amber-600">Mobile Image nahi hai - Desktop hi use hogi</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <EditHeroSlideButton slide={s} />
                    <DeleteButton id={s.id} action={deleteHeroSlide} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <NewHeroSlideForm />
      </div>
    </div>
  );
}