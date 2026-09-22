"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vehicleForStaff, recordOpening, recordFuel, recordClosing } from "@/lib/vehicle-daily-log";

export interface VehicleActionState {
  error?: string;
  success?: boolean;
  notice?: string;
  /** Nishan -- rok nahi. Staff ko dikhta hai ke manager kya dekhega. */
  flags?: string[];
}

/**
 * Gaari ka rozana hisaab -- app ke safhe se (178).
 *
 * Hisaab yahan NAHI hota. Teenon function wohi hain jo WhatsApp ka
 * raasta bulata hai (src/lib/vehicle-daily-log.ts). Yahan sirf ye tay
 * hota hai ke likhne wala kaun hai aur us ke naam par kaun si gaari
 * lagi hui hai.
 *
 * Gaari kabhi FORM se nahi aati -- hamesha login se. Form par gaari ka
 * khana rakhna kisi bhi bande ko kisi bhi gaari par kharcha likhne ki
 * ijazat de deta.
 */
async function meAndVehicle() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." as const };

  const { data: me } = await supabase
    .from("profiles")
    .select("id, branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { error: "Ye login abhi chalu nahi hai." as const };

  const vehicle = await vehicleForStaff(me.id);
  if (!vehicle) {
    return { error: "Aap ke naam par koi gaari nahi lagi. Admin se kehein ke gaari assign kar de." as const };
  }
  return { profileId: me.id, branchId: (me.branch_id as string | null) ?? null, vehicle };
}

function km(formData: FormData): number | null {
  const raw = Number(formData.get("km") ?? 0);
  if (!raw || raw <= 0) return null;
  return raw;
}

export async function saveOpeningMeter(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const ctx = await meAndVehicle();
  if ("error" in ctx) return { error: ctx.error };

  const reading = km(formData);
  if (reading === null) return { error: "Meter ka number likhein." };

  const photo = String(formData.get("photo_path") ?? "").trim();
  if (!photo) return { error: "Meter ki tasveer laazmi hai." };

  const result = await recordOpening(ctx.vehicle, ctx.profileId, ctx.branchId, reading, { photoPath: photo });
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/my-vehicle");
  return { success: true, notice: result.message, flags: result.flags };
}

export async function saveVehicleFuel(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const ctx = await meAndVehicle();
  if ("error" in ctx) return { error: ctx.error };

  const liters = Number(formData.get("liters") ?? 0) || null;
  const rate = Number(formData.get("rate_per_liter") ?? 0) || null;
  const amount = Number(formData.get("amount") ?? 0) || null;
  if (!liters || liters <= 0) return { error: "Kitne litre daale, wo likhein." };
  if (!amount || amount <= 0) return { error: "Bill ki raqam likhein." };

  const receipt = String(formData.get("photo_path") ?? "").trim();
  if (!receipt) return { error: "Bill ki tasveer laazmi hai." };

  const result = await recordFuel(
    ctx.vehicle,
    ctx.profileId,
    ctx.branchId,
    { liters, ratePerLiter: rate, amount, receiptPath: receipt },
    { photoPath: receipt }
  );
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/my-vehicle");
  return { success: true, notice: result.message, flags: result.flags };
}

export async function saveClosingMeter(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const ctx = await meAndVehicle();
  if ("error" in ctx) return { error: ctx.error };

  const reading = km(formData);
  if (reading === null) return { error: "Meter ka number likhein." };

  const photo = String(formData.get("photo_path") ?? "").trim();
  if (!photo) return { error: "Meter ki tasveer laazmi hai." };

  const result = await recordClosing(ctx.vehicle, reading, { photoPath: photo });
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/my-vehicle");
  revalidatePath("/admin/vehicles");
  return {
    success: true,
    notice: `Aaj ${result.kmTravelled.toLocaleString()} km chale${
      result.kmPerLiter ? ` — mileage ${result.kmPerLiter} km/litre` : ""
    }. Hisaab manager ke paas verify ke liye chala gaya hai.`,
    flags: result.flags,
  };
}
