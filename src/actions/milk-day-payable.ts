"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/actions/milk";

/** Chiller din ka farmer ko kul dena likhne wale roles (migration 733 ki policy ke saath). */
const WRITE_ROLES = ["owner", "super_admin", "admin", "manager"];
const MAX_AMOUNT = 100000000;

/**
 * Din ka kul farmer ko dena (Rs). Farmer ki alag qatar nahi: statement bahar
 * bana kar us ka kul yahan likha jata hai. Ek din, ek branch ki ek hi qatar.
 */
export async function saveDayFarmerPayable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const date = String(formData.get("entry_date") ?? "");
  const branchId = String(formData.get("branch_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tareekh sahi nahi." };
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) return { error: "Branch sahi nahi." };
  const amount = Number(amountRaw);
  if (amountRaw === "" || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    return { error: "Rupay ki raqam sahi nahi (0 ya is se zyada)." };
  }
  if (note && note.length > 255) return { error: "Note 255 harf se zyada nahi ho sakta." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !WRITE_ROLES.includes(me.role)) {
    return { error: "Is raqam ko likhne ki ijazat nahi." };
  }

  // Types mein ye table abhi nahi (733 Testing par chalne ke baad types regenerate hon).
  const { error } = await (supabase as any)
    .from("milk_day_farmer_payables")
    .upsert(
      {
        branch_id: branchId,
        entry_date: date,
        amount,
        note,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "branch_id,entry_date" }
    );
  if (error) return { error: `Save nahi hua: ${error.message}` };

  revalidatePath("/admin/milk-collection/control-room");
  return { success: true };
}
