import { ControlEntryForm } from "./control-entry-form";
import { listCollectors } from "@/actions/milk-collectors";
import { listChillars } from "@/actions/milk-chillars";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ControlEntryPage() {
  const supabase = createClient();
  const [{ data: farmers }, collectors, chillars] = await Promise.all([
    supabase.from("farmers").select("id, full_name").eq("is_deleted", false).order("full_name").limit(200),
    listCollectors(),
    listChillars(),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Control Entry – Milk</h1>
      <ControlEntryForm
        farmers={(farmers ?? []).map((f: any) => ({ id: f.id, name: f.full_name }))}
        collectors={collectors.map((c: any) => ({ id: c.id, name: c.name }))}
        chillars={chillars.map((c: any) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
