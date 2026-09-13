import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { AiInstructionsForm } from "./ai-instructions-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AiInstructionsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: row } = await supabase.from("ai_report_instructions").select("instructions").limit(1).maybeSingle();

  return (
    <div>
      <PageHeader title={t("at_ai_instructions", lang)} description="AI ko naye instructions dein - ye har roz follow honge" />
      <AiInstructionsForm currentInstructions={row?.instructions ?? ""} />
    </div>
  );
}