import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { AiInstructionsForm } from "./ai-instructions-form";

export const dynamic = "force-dynamic";

export default async function AiInstructionsPage() {
  const supabase = createClient();
  const { data: row } = await supabase.from("ai_report_instructions").select("instructions").limit(1).maybeSingle();

  return (
    <div>
      <PageHeader title="AI Instructions" description="AI ko naye instructions dein - ye har roz follow honge" />
      <AiInstructionsForm currentInstructions={row?.instructions ?? ""} />
    </div>
  );
}