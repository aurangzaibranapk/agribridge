import { createClient } from "@/lib/supabase/server";
import { FaqAccordion } from "@/app/(site)/faq/faq-accordion";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const supabase = createClient();
  const { data: faqs } = await supabase.from("faqs").select("*").eq("is_published", true).order("category").order("display_order");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">Frequently Asked Questions</h1>
        <p className="mx-auto mt-2 max-w-lg text-surface-500 dark:text-surface-400">Answers to the questions we hear most often.</p>
      </div>
      <div className="mt-10">
        <FaqAccordion faqs={faqs ?? []} />
      </div>
    </div>
  );
}
