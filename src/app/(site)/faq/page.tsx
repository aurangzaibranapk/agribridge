import { createClient } from "@/lib/supabase/server";
import { FaqAccordion } from "@/app/(site)/faq/faq-accordion";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: faqs } = await supabase.from("faqs").select("*").eq("is_published", true).order("category").order("display_order");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">{t("sp_faq_title", lang)}</h1>
        <p className="mx-auto mt-2 max-w-lg text-surface-500 dark:text-surface-400">{t("sp_faq_lead", lang)}</p>
      </div>
      <div className="mt-10">
        <FaqAccordion faqs={faqs ?? []} />
      </div>
    </div>
  );
}
