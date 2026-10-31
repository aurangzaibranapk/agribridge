"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/actions/milk";

/** Chiller ki master list sirf in roles se badlti hai (737 ki policy ke saath). */
const ADMIN_ROLES = ["owner", "super_admin", "admin"];
const UUID = /^[0-9a-f-]{36}$/i;

async function adminGate(): Promise<{ userId: string } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ADMIN_ROLES.includes(me.role)) return { error: "Chiller badalne ki ijazat sirf Admin ko hai." };
  return { userId: user.id };
}

function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > 40) return null;
  return name;
}

/** Naya chiller jorta hai, branch ki agli khali number par. */
export async function addChillerMaster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const branchId = String(formData.get("branch_id") ?? "");
  const name = cleanName(String(formData.get("name") ?? ""));
  if (!UUID.test(branchId)) return { error: "Branch sahi nahi." };
  if (!name) return { error: "Chiller ka naam 1 se 40 harf ka likhein." };
  const gate = await adminGate();
  if ("error" in gate) return { error: gate.error };

  const db = createClient() as any;
  const { data: rows, error: readErr } = await db
    .from("milk_chiller_master")
    .select("sort_no")
    .eq("branch_id", branchId)
    .order("sort_no", { ascending: false })
    .limit(1);
  if (readErr) return { error: `Chiller ki list nahi padhi: ${readErr.message}` };
  const nextSort = ((rows?.[0]?.sort_no as number | undefined) ?? 0) + 1;

  const { error } = await db.from("milk_chiller_master").insert({
    branch_id: branchId,
    sort_no: nextSort,
    name,
    is_active: true,
    updated_by: gate.userId,
  });
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "Is naam ka chiller pehle se hai." : `Save nahi hua: ${error.message}` };
  revalidatePath("/admin/milk-collection/chillers");
  return { success: true };
}

/** Chiller ka naam badalta hai. */
export async function renameChillerMaster(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const name = cleanName(String(formData.get("name") ?? ""));
  if (!UUID.test(id)) return { error: "Chiller sahi nahi." };
  if (!name) return { error: "Naam 1 se 40 harf ka likhein." };
  const gate = await adminGate();
  if ("error" in gate) return { error: gate.error };

  const { error } = await (createClient() as any)
    .from("milk_chiller_master")
    .update({ name, updated_by: gate.userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "Is naam ka chiller pehle se hai." : `Save nahi hua: ${error.message}` };
  revalidatePath("/admin/milk-collection/chillers");
  return { success: true };
}

/** Chiller ko faal ya band karta hai. Band chiller naye slip mein nahi aata. */
export async function setChillerMasterActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "yes";
  if (!UUID.test(id)) return { error: "Chiller sahi nahi." };
  const gate = await adminGate();
  if ("error" in gate) return { error: gate.error };

  const { error } = await (createClient() as any)
    .from("milk_chiller_master")
    .update({ is_active: active, updated_by: gate.userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `Save nahi hua: ${error.message}` };
  revalidatePath("/admin/milk-collection/chillers");
  return { success: true };
}
