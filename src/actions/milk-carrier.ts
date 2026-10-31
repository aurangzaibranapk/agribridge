"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/actions/milk";

/** Carrier aur rate likhne wale roles (734 ki policy ke saath). */
const WRITE_ROLES = ["owner", "super_admin", "admin", "manager"];
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Dispatch ko carrier (Wasela, vendor, hum khud) se jorta hai, aur us ko diya
 * gaya rate likhta hai. Naya naam ho to pehle carrier banta hai.
 */
export async function saveDispatchCarrier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const dispatchId = String(formData.get("dispatch_id") ?? "");
  const carrierId = String(formData.get("carrier_id") ?? "").trim();
  const newName = String(formData.get("new_carrier_name") ?? "").trim();
  const rateRaw = String(formData.get("carrier_rate") ?? "").trim();

  if (!UUID.test(dispatchId)) return { error: "Dispatch sahi nahi." };
  if (!carrierId && !newName) return { error: "Carrier chunein ya naya naam likhein." };
  const rate = rateRaw === "" ? null : Number(rateRaw);
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100000)) {
    return { error: "Rate sahi nahi (0 ya is se zyada)." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !WRITE_ROLES.includes(me.role)) return { error: "Is ki ijazat nahi." };

  // Types mein 734 abhi nahi (types regenerate hone par `as any` hata dein).
  const db = supabase as any;
  let resolvedCarrier = carrierId;
  if (!resolvedCarrier) {
    const { data: existing } = await db
      .from("milk_carriers")
      .select("id")
      .ilike("name", newName)
      .eq("is_active", true)
      .maybeSingle();
    if (existing?.id) {
      resolvedCarrier = existing.id;
    } else {
      const { data: created, error: createErr } = await db
        .from("milk_carriers")
        .insert({ name: newName, kind: "vendor", created_by: user.id })
        .select("id")
        .single();
      if (createErr) return { error: `Naya carrier save nahi hua: ${createErr.message}` };
      resolvedCarrier = created.id;
    }
  } else if (!UUID.test(resolvedCarrier)) {
    return { error: "Carrier sahi nahi." };
  }

  const { error } = await db
    .from("milk_dispatches")
    .update({ carrier_id: resolvedCarrier, carrier_rate: rate })
    .eq("id", dispatchId);
  if (error) return { error: `Save nahi hua: ${error.message}` };

  revalidatePath("/admin/milk-collection/carrier");
  revalidatePath("/admin/milk-collection/control-room");
  return { success: true };
}
