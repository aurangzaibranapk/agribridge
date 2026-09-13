import { Quote, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function TestimonialsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: testimonials } = await supabase.from("testimonials").select("*").eq("is_published", true).order("display_order");

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">{t("sh_happy_farmers", lang)}</h1>
        <p className="mx-auto mt-2 max-w-lg text-surface-500 dark:text-surface-400">{t("sp_testimonials_lead", lang)}</p>
      </div>

      {(!testimonials || testimonials.length === 0) ? (
        <p className="mt-10 text-center text-sm text-surface-400 dark:text-surface-500">{t("sp_no_testimonials", lang)}</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <Quote className="h-5 w-5 text-brand-300" />
              <div className="mt-2 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < t.rating ? "fill-wheat-500 text-wheat-500" : "text-surface-200"}`} />
                ))}
              </div>
              <p className="mt-3 text-sm text-surface-700 dark:text-surface-300">&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-4 text-sm font-semibold text-surface-900 dark:text-white">{t.customer_name}</p>
              <p className="text-xs text-surface-400 dark:text-surface-500">{t.location}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
