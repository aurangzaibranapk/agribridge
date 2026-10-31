import { createClient } from "@/lib/supabase/server";
import { chillerStockRows, type ChillerIdentity, type HandoverLineInput } from "@/lib/milk-handover";

/**
 * Is shift ke chiller naam (milk_entries) aur isi branch ki pichli
 * slip ke chiller number. Lab khali. Purane number nahi mit-te —
 * caller absorbChillerStock se jorta hai.
 */
export async function loadChillerStock(branchId: string, date: string, shift: string): Promise<HandoverLineInput[]> {
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  if (shift !== "morning" && shift !== "evening") return [];
  const supabase = createClient();
  const entries = await supabase
    .from("milk_entries")
    .select("chiller_name")
    .eq("branch_id", branchId)
    .eq("entry_date", date)
    .eq("shift", shift)
    .limit(200);
  const shiftNames = (entries.data ?? []).map((row) => row.chiller_name ?? "").filter((name) => name.trim());
  const recent = await supabase
    .from("milk_dispatches")
    .select("id")
    .eq("branch_id", branchId)
    .order("dispatch_date", { ascending: false })
    .limit(6);
  const ids = (recent.data ?? []).map((row) => row.id);
  let previous: ChillerIdentity[] = [];
  if (ids.length) {
    const lines = await supabase
      .from("milk_dispatch_lines")
      .select("dispatch_id, line_no, chiller_no, milk_type")
      .in("dispatch_id", ids)
      .order("line_no");
    const firstId = ids.find((id) => (lines.data ?? []).some((line) => line.dispatch_id === id));
    previous = (lines.data ?? [])
      .filter((line) => line.dispatch_id === firstId)
      .map((line) => ({ chillerNo: line.chiller_no, milkType: line.milk_type }));
  }
  return chillerStockRows(previous, shiftNames);
}
