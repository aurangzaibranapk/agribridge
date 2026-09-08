"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { computeShiftCash, type ShiftCashSummary } from "@/lib/pos/shift-cash";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function main() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  return {
    userId: user.id,
    role: String(profile.role),
    branchId: (profile.branch_id as string | null) ?? null,
    naam: (profile.full_name as string | null) ?? "",
    unrestricted: UNRESTRICTED_ROLES.includes(String(profile.role)),
  };
}

/**
 * Counter management: Owner/Admin sab branch, Manager sirf apni branch.
 *
 * Malik ka usool jo Kharche mein tay hua (8 September): "manager lagate
 * hain to uski branch ki hadd tak" -- yehi hadd yahan counter banane aur
 * staff lagane par bhi lagti hai.
 */
function manageKarSaktaHai(who: { unrestricted: boolean; role: string; branchId: string | null }, branchId: string) {
  if (who.unrestricted) return true;
  return who.role === "manager" && who.branchId === branchId;
}

async function nextShiftNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await service
    .from("pos_shift_counters")
    .select("last_number")
    .eq("year", year)
    .maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await service.from("pos_shift_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("pos_shift_counters").insert({ year, last_number: next });
  }
  return `SHIFT-${year}-${String(next).padStart(5, "0")}`;
}

/** Naya POS Counter -- Branch + Shop. Warehouse khud shop se nikal jata hai (trigger). */
export async function createPosCounter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const branchId = String(formData.get("branch_id") ?? "");
  const shopId = String(formData.get("shop_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!branchId || !shopId || !name) return { error: "Naam, Branch aur Shop teenon zaroori hain." };
  if (!manageKarSaktaHai(who, branchId)) return { error: "Sirf is branch ka Manager ya Owner/Admin counter bana sakta hai." };

  const service = createServiceClient();
  const { data: shop } = await service.from("shops").select("id, branch_id").eq("id", shopId).maybeSingle();
  if (!shop || shop.branch_id !== branchId) return { error: "Ye shop is branch ki nahi hai." };

  const { data: row, error } = await service
    .from("pos_counters")
    .insert({ name, branch_id: branchId, shop_id: shopId, created_by: who.userId })
    .select("id")
    .single();
  if (error) return { error: error.message.includes("unique") ? "Is shop mein isi naam ka counter pehle se hai." : error.message };

  await logAudit({
    actionType: "create",
    module: "pos-counters",
    recordId: row?.id,
    recordLabel: name,
    description: `POS Counter "${name}" banaya.`,
  });

  revalidatePath("/admin/pos-counters");
  return { success: true, message: `"${name}" ban gaya.` };
}

/** Counter band/chalu karna. */
export async function setPosCounterStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("is_active") === "true";
  const service = createServiceClient();
  const { data: counter } = await service.from("pos_counters").select("branch_id, name").eq("id", id).maybeSingle();
  if (!counter) return { error: "Counter nahi mila." };
  if (!manageKarSaktaHai(who, counter.branch_id)) return { error: "Ijazat nahi hai." };

  const { error } = await service.from("pos_counters").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "pos-counters",
    recordId: id,
    recordLabel: counter.name,
    description: isActive ? "Counter chalu kiya." : "Counter band kiya.",
  });

  revalidatePath("/admin/pos-counters");
  return { success: true };
}

/** Staff ko counter par lagana -- ek staff, kai counters (many-to-many). */
export async function assignCounterStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const counterId = String(formData.get("counter_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  if (!counterId || !profileId) return { error: "Counter aur staff dono chunein." };

  const service = createServiceClient();
  const { data: counter } = await service.from("pos_counters").select("branch_id, name").eq("id", counterId).maybeSingle();
  if (!counter) return { error: "Counter nahi mila." };
  if (!manageKarSaktaHai(who, counter.branch_id)) return { error: "Ijazat nahi hai." };

  const { data: staff } = await service.from("profiles").select("full_name, branch_id").eq("id", profileId).maybeSingle();
  if (!staff) return { error: "Staff nahi mila." };
  if (staff.branch_id !== counter.branch_id) {
    return { error: "Ye staff is branch ka nahi hai -- pehle us ki branch theek karein." };
  }

  const { error } = await service
    .from("pos_counter_staff")
    .upsert({ counter_id: counterId, profile_id: profileId, granted_by: who.userId, is_active: true }, { onConflict: "counter_id,profile_id" });
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "pos-counters",
    recordId: counterId,
    recordLabel: counter.name,
    description: `${staff.full_name} ko is counter ki ijazat di.`,
  });

  revalidatePath("/admin/pos-counters");
  return { success: true, message: `${staff.full_name} ko ijazat mil gayi.` };
}

/** Staff ki counter wali ijazat hatana. */
export async function revokeCounterStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const counterId = String(formData.get("counter_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  const service = createServiceClient();
  const { data: counter } = await service.from("pos_counters").select("branch_id, name").eq("id", counterId).maybeSingle();
  if (!counter) return { error: "Counter nahi mila." };
  if (!manageKarSaktaHai(who, counter.branch_id)) return { error: "Ijazat nahi hai." };

  const { error } = await service
    .from("pos_counter_staff")
    .update({ is_active: false })
    .eq("counter_id", counterId)
    .eq("profile_id", profileId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "pos-counters",
    recordId: counterId,
    recordLabel: counter.name,
    description: "Staff ki counter wali ijazat hatai.",
  });

  revalidatePath("/admin/pos-counters");
  return { success: true };
}

/**
 * Shift Open -- Phase 6. Sirf wohi staff kar sakta hai jise counter par
 * ijazat hai. Database ki unique index (366) khud rok deti hai agar is
 * counter par ya is staff ka pehle se koi khula shift ho.
 */
export async function openShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const counterId = String(formData.get("counter_id") ?? "");
  const openingCash = Number(formData.get("opening_cash") ?? 0);
  if (!counterId) return { error: "Counter nahi mila." };
  if (!Number.isFinite(openingCash) || openingCash < 0) return { error: "Opening cash sahi likhein." };

  const service = createServiceClient();
  const { data: allowed } = await service
    .from("pos_counter_staff")
    .select("id")
    .eq("counter_id", counterId)
    .eq("profile_id", who.userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!allowed && !who.unrestricted) return { error: "Aapko is counter ki ijazat nahi hai." };

  const shiftNumber = await nextShiftNumber();
  const { data: row, error } = await service
    .from("pos_shifts")
    .insert({ shift_number: shiftNumber, counter_id: counterId, staff_id: who.userId, opening_cash: openingCash })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("uq_pos_shift_open_counter")) return { error: "Is counter par pehle se koi shift khula hai." };
    if (error.message.includes("uq_pos_shift_open_staff")) return { error: "Aapka pehle se ek shift khula hai — pehle wo band karein." };
    return { error: error.message };
  }

  await logAudit({
    actionType: "create",
    module: "pos-shifts",
    recordId: row?.id,
    recordLabel: shiftNumber,
    description: `Shift khola — opening cash Rs ${openingCash.toLocaleString()}.`,
  });

  revalidatePath("/admin/pos");
  return { success: true, message: `${shiftNumber} khul gaya.` };
}

/**
 * Shift Close se PEHLE dikhane ke liye -- "system khud bataye kitni sale
 * hui hai", bina staff se pehle physical cash maangte hue. Malik (8
 * September): "system ko khud balance batana chahiye, kya sale hui hai."
 *
 * Yehi hisaab `closeShift` bhi istemal karta hai (computeShiftCash) --
 * dikhaya gaya adad aur band karte waqt ginta gaya adad kabhi alag nahi
 * ho sakte.
 */
export async function getShiftSummary(shiftId: string): Promise<ShiftCashSummary | { error: string }> {
  const who = await main();
  if ("error" in who) return { error: who.error ?? "Login zaroori hai." };

  const service = createServiceClient();
  const { data: shift } = await service.from("pos_shifts").select("opening_cash, staff_id").eq("id", shiftId).maybeSingle();
  if (!shift) return { error: "Shift nahi mila." };
  if (shift.staff_id !== who.userId && !who.unrestricted) return { error: "Sirf apna shift dekh sakte hain." };

  return computeShiftCash(shiftId, Number(shift.opening_cash));
}

/**
 * Shift Close -- Phase 6. Expected cash = opening + is shift ki cash
 * sales − isi shift ki sale par hui cash returns. (Cash Recovery aur
 * "other valid movement" abhi is hisaab mein shamil NAHI -- POS abhi
 * unhen alag se track nahi karta; "Rs 0" likhne ke bajaye ye khana
 * abhi report mein hi nahi hai.)
 */
export async function closeShift(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const shiftId = String(formData.get("shift_id") ?? "");
  const countedCash = Number(formData.get("counted_cash") ?? NaN);
  const closingNote = String(formData.get("closing_note") ?? "").trim() || null;
  if (!shiftId) return { error: "Shift nahi mila." };
  if (!Number.isFinite(countedCash) || countedCash < 0) return { error: "Ginti hui (physical) cash sahi likhein." };

  const service = createServiceClient();
  const { data: shift } = await service
    .from("pos_shifts")
    .select("id, staff_id, opening_cash, status")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift) return { error: "Shift nahi mila." };
  if (shift.status !== "open") return { error: "Ye shift pehle hi band ho chuka hai." };
  if (shift.staff_id !== who.userId && !who.unrestricted) return { error: "Sirf apna shift band kar sakte hain." };

  const { expectedCash } = await computeShiftCash(shiftId, Number(shift.opening_cash));
  const difference = Math.round((countedCash - expectedCash) * 100) / 100;

  const { error } = await service
    .from("pos_shifts")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      counted_cash: countedCash,
      expected_cash: expectedCash,
      difference,
      closing_note: closingNote,
      closed_by: who.userId,
    })
    .eq("id", shiftId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "pos-shifts",
    recordId: shiftId,
    recordLabel: shiftId,
    description: `Shift band — expected Rs ${expectedCash.toLocaleString()}, ginti Rs ${countedCash.toLocaleString()}, farq Rs ${difference.toLocaleString()}.`,
  });

  revalidatePath("/admin/pos");
  return {
    success: true,
    message:
      difference === 0
        ? "Shift band — cash poora milta hai."
        : `Shift band — farq Rs ${difference.toLocaleString()} (${difference > 0 ? "zyada" : "kam"}).`,
  };
}
