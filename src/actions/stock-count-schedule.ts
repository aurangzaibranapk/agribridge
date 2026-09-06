"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export interface ScheduleState {
  error?: string;
  success?: boolean;
  notice?: string;
}

const ADMIN_ROLES = ["owner", "super_admin", "admin"];

/**
 * Kisi godam ki ginti ki tarteeb badalna.
 *
 * Malik (6 September): *"hum marzi se din set kar sakein — kis din kis
 * ka stock count chahiye. Daily stock count ke liye bohat time lagta
 * hai."*
 *
 * -------------------------------------------------------------------
 * TARTEEB BADALNA GINNE WALE KA KAAM NAHI
 *
 * Ye action sirf Admin darje ke liye hai -- zimmedar ke liye nahi, aur
 * ye rok jaan boojh kar hai. Agar ginne wala apni hi tareekh aage kar
 * sakta ho to ginti hamesha "kal" hoti rehti hai, aur nizam mein aisi
 * ghaflat kabhi late nazar hi nahi aati.
 *
 * Rok database mein bhi hai (`scs_write` policy), yahan sirf saaf
 * paighaam ke liye.
 *
 * -------------------------------------------------------------------
 * "BAND" KI WAJAH LAZMI HAI
 *
 * Ginti band karna ek faisla hai, khali khana nahi. Wajah ke baghair
 * kal koi dekhta hai ke godam nigrani se bahar hai aur ye nahi bata
 * sakta ke kisi ne tay kiya tha ya bhool gaye the.
 */
export async function saveCountSchedule(
  _prev: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !ADMIN_ROLES.includes(me.role)) {
    return { error: "Tarteeb sirf Admin ya Malik badal sakte hain." };
  }

  const warehouseId = String(formData.get("warehouse_id") ?? "");
  if (!warehouseId) return { error: "Godam chunein." };

  const cycleKind = String(formData.get("cycle_kind") ?? "har_n_din");
  const zimmedar = (formData.get("zimmedar") as string) || null;
  const bandKiWajah = String(formData.get("band_ki_wajah") ?? "").trim() || null;

  const harNDinRaw = String(formData.get("har_n_din") ?? "").trim();
  const tareekhRaw = String(formData.get("mahine_ki_tareekh") ?? "").trim();

  // Har qism ka apna khana. Database par bhi yehi rok hai; yahan is liye
  // ke banda ko wajah samajh aaye, "constraint violated" na mile.
  let harNDin: number | null = null;
  let mahineKiTareekh: number | null = null;

  if (cycleKind === "har_n_din") {
    harNDin = harNDinRaw === "" ? NaN : Number(harNDinRaw);
    if (!Number.isFinite(harNDin) || harNDin < 1 || harNDin > 365) {
      return { error: "Kitne din baad ginna hai — 1 se 365 ke beech koi adad likhein." };
    }
  } else if (cycleKind === "mahine_ki_tareekh") {
    mahineKiTareekh = tareekhRaw === "" ? NaN : Number(tareekhRaw);
    if (!Number.isFinite(mahineKiTareekh) || mahineKiTareekh < 1 || mahineKiTareekh > 28) {
      // 28 tak is liye ke har mahine mein 29, 30, 31 nahi hote. 31 chun
      // lene par February wali ginti kabhi due hi na hoti.
      return { error: "Mahine ki tareekh 1 se 28 ke beech chunein (har mahine mein 29/30/31 nahi hote)." };
    }
  } else if (cycleKind === "band") {
    if (!bandKiWajah || bandKiWajah.length < 5) {
      return { error: "Ginti band karne ki wajah likhein — kam se kam paanch harf." };
    }
  } else if (cycleKind !== "mahine_ke_aakhir") {
    return { error: "Ye tarteeb pehchani nahi gayi." };
  }

  const { data: before } = await supabase
    .from("stock_count_schedules")
    .select("cycle_kind, har_n_din, mahine_ki_tareekh, zimmedar, band_ki_wajah")
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  const { error } = await supabase.from("stock_count_schedules").upsert(
    {
      warehouse_id: warehouseId,
      cycle_kind: cycleKind,
      har_n_din: harNDin,
      mahine_ki_tareekh: mahineKiTareekh,
      zimmedar: zimmedar,
      band_ki_wajah: cycleKind === "band" ? bandKiWajah : null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "warehouse_id" }
  );
  if (error) return { error: error.message };

  await logAudit({
    actionType: before ? "update" : "create",
    module: "stock_count",
    recordId: warehouseId,
    recordLabel: "Ginti ki tarteeb",
    description: "Godam ki ginti ki tarteeb badli gayi",
    changes: {
      cycle_kind: { pehle: before?.cycle_kind ?? null, ab: cycleKind },
      har_n_din: { pehle: before?.har_n_din ?? null, ab: harNDin },
      mahine_ki_tareekh: { pehle: before?.mahine_ki_tareekh ?? null, ab: mahineKiTareekh },
      zimmedar: { pehle: before?.zimmedar ?? null, ab: zimmedar },
      band_ki_wajah: { pehle: before?.band_ki_wajah ?? null, ab: cycleKind === "band" ? bandKiWajah : null },
    },
  });

  revalidatePath("/admin/stock-count");
  return { success: true, notice: "Tarteeb mehfooz ho gayi." };
}
