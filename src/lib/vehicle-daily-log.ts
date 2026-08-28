import { createServiceClient } from "@/lib/supabase/service";

/**
 * Motorcycle ka rozana hisaab.
 *
 * Din bhar mein teen cheezein alag alag waqt aati hain: subah ka meter,
 * petrol ka bill, shaam ka meter. Ek hi log un teenon ko jorta hai.
 *
 * Har khud-kar check sirf NISHAN lagata hai — kisi entry ko rokta nahi.
 * Meter dhundla ho ya bill ka hisaab na mile, tab bhi record ban jata
 * hai; faisla manager karta hai. Rok dene se staff kaam chhoR kar
 * daftar ke chakkar lagata hai, aur asal saboot kabhi darj hi nahi hota.
 */

/** Kitne fisad ka farq nishan lagane ke qabil hai (fuel.ts wahi 25% istemal karta hai). */
const MILEAGE_TOLERANCE = 0.25;
/** Ek din mein itne se zyada KM chalna ghair-mamooli hai. */
const ABNORMAL_KM_PER_DAY = 400;

export interface VehicleForStaff {
  id: string;
  vehicleName: string;
  registrationNo: string | null;
  expectedKmPerLiter: number;
  branchId: string | null;
}

/** Is staff ke naam par kaun si gaari lagi hui hai. */
export async function vehicleForStaff(profileId: string): Promise<VehicleForStaff | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("vehicles")
    .select("id, vehicle_name, registration_no, expected_km_per_liter, branch_id")
    .eq("assigned_profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    vehicleName: data.vehicle_name,
    registrationNo: data.registration_no,
    expectedKmPerLiter: Number(data.expected_km_per_liter ?? 45),
    branchId: data.branch_id,
  };
}

async function nextLogNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await service.from("vehicle_log_counters").select("last_number").eq("year", year).maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await service.from("vehicle_log_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("vehicle_log_counters").insert({ year, last_number: next });
  }
  return `VLG-${year}-${String(next).padStart(5, "0")}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Aaj ka log — ho to wahi, na ho to null. */
export async function todaysLog(vehicleId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("vehicle_daily_logs")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("log_date", today())
    .maybeSingle();
  return data;
}

/** Pichhle din ki aakhri closing — aaj ki opening us se milani hoti hai. */
async function previousClosingKm(vehicleId: string): Promise<number | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("vehicle_daily_logs")
    .select("closing_km")
    .eq("vehicle_id", vehicleId)
    .lt("log_date", today())
    .not("closing_km", "is", null)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.closing_km == null ? null : Number(data.closing_km);
}

export interface OpeningResult {
  logNumber: string;
  flags: string[];
  message: string;
}

/** Subah ka meter darj karta hai. */
export async function recordOpening(
  vehicle: VehicleForStaff,
  staffProfileId: string,
  branchId: string | null,
  km: number,
  submissionId: string
): Promise<OpeningResult | { error: string }> {
  const service = createServiceClient();
  const existing = await todaysLog(vehicle.id);

  if (existing?.opening_km != null) {
    return { error: `Aaj ka subah wala meter pehle hi darj hai (${Number(existing.opening_km).toLocaleString()} km).` };
  }

  const flags: string[] = [];
  const prevClosing = await previousClosingKm(vehicle.id);
  if (prevClosing != null && km < prevClosing) {
    flags.push(`Aaj ki opening (${km.toLocaleString()} km) kal ki closing (${prevClosing.toLocaleString()} km) se kam hai.`);
  }
  if (prevClosing != null && km - prevClosing > ABNORMAL_KM_PER_DAY) {
    flags.push(`Kal ki closing se aaj ki opening tak ${Math.round(km - prevClosing).toLocaleString()} km ka farq hai.`);
  }

  const now = new Date().toISOString();

  if (existing) {
    await service
      .from("vehicle_daily_logs")
      .update({ opening_km: km, opening_at: now, opening_submission_id: submissionId, flags: [...(existing.flags as string[] ?? []), ...flags] as never, updated_at: now })
      .eq("id", existing.id);
    return { logNumber: existing.log_number, flags, message: "Subah ka meter darj ho gaya." };
  }

  const logNumber = await nextLogNumber();
  const { error } = await service.from("vehicle_daily_logs").insert({
    log_number: logNumber,
    vehicle_id: vehicle.id,
    staff_profile_id: staffProfileId,
    branch_id: branchId ?? vehicle.branchId,
    log_date: today(),
    opening_km: km,
    opening_at: now,
    opening_submission_id: submissionId,
    flags: flags as never,
    status: "open",
  });
  if (error) return { error: error.message };

  return { logNumber, flags, message: "Subah ka meter darj ho gaya." };
}

export interface FuelResult {
  flags: string[];
  message: string;
}

/** Petrol ka bill darj karta hai. Din mein kai baar ho sakta hai. */
export async function recordFuel(
  vehicle: VehicleForStaff,
  staffProfileId: string,
  branchId: string | null,
  fuel: { liters: number | null; ratePerLiter: number | null; amount: number | null; receiptPath: string | null },
  submissionId: string
): Promise<FuelResult | { error: string }> {
  const service = createServiceClient();
  let log = await todaysLog(vehicle.id);

  // Subah ka meter na aaya ho to bhi bill darj hota hai — warna saboot
  // zaya ho jata. Nishan laga dete hain.
  const flags: string[] = [];
  if (!log) {
    const logNumber = await nextLogNumber();
    const { data } = await service
      .from("vehicle_daily_logs")
      .insert({
        log_number: logNumber,
        vehicle_id: vehicle.id,
        staff_profile_id: staffProfileId,
        branch_id: branchId ?? vehicle.branchId,
        log_date: today(),
        status: "open",
        flags: ["Petrol ka bill subah ke meter se pehle aaya."] as never,
      })
      .select("*")
      .single();
    log = data;
  }
  if (!log) return { error: "Aaj ka log nahi ban saka." };

  // Bill ka apna hisaab: litre x rate = raqam. Na mile to nishan.
  let mismatch = false;
  if (fuel.liters != null && fuel.ratePerLiter != null && fuel.amount != null) {
    const computed = fuel.liters * fuel.ratePerLiter;
    // Ek fisad ki gunjaish — pump ke bill mein rounding aam baat hai.
    if (Math.abs(computed - fuel.amount) > Math.max(5, fuel.amount * 0.01)) {
      mismatch = true;
      flags.push(`Bill ka hisaab nahi milta: ${fuel.liters} litre x Rs ${fuel.ratePerLiter} = Rs ${Math.round(computed).toLocaleString()}, magar bill par Rs ${fuel.amount.toLocaleString()} likha hai.`);
    }
  } else {
    flags.push("Bill se litre/rate/raqam poori tarah nahi parhi ja saki.");
  }

  const { error } = await service.from("vehicle_fuel_entries").insert({
    daily_log_id: log.id,
    submission_id: submissionId,
    liters: fuel.liters,
    rate_per_liter: fuel.ratePerLiter,
    amount: fuel.amount,
    amount_mismatch: mismatch,
    receipt_path: fuel.receiptPath,
  });
  if (error) return { error: error.message };

  if (flags.length) {
    await service
      .from("vehicle_daily_logs")
      .update({ flags: [...((log.flags as string[]) ?? []), ...flags] as never, updated_at: new Date().toISOString() })
      .eq("id", log.id);
  }

  return { flags, message: "Petrol ka bill darj ho gaya." };
}

export interface ClosingResult {
  logNumber: string;
  kmTravelled: number;
  fuelLiters: number | null;
  kmPerLiter: number | null;
  expectedLiters: number | null;
  litersDifference: number | null;
  fuelAmount: number | null;
  costPerKm: number | null;
  flags: string[];
}

/** Shaam ka meter — yahin poore din ka hisaab banta hai. */
export async function recordClosing(
  vehicle: VehicleForStaff,
  km: number,
  submissionId: string
): Promise<ClosingResult | { error: string }> {
  const service = createServiceClient();
  const log = await todaysLog(vehicle.id);

  if (!log) return { error: "Aaj ka koi log nahi mila. Pehle subah ka meter bhejein." };
  if (log.opening_km == null) return { error: "Subah ka meter darj nahi hua. Pehle wo bhejein." };
  if (log.closing_km != null) return { error: `Aaj ka shaam wala meter pehle hi darj hai (${Number(log.closing_km).toLocaleString()} km).` };

  const openingKm = Number(log.opening_km);
  const flags: string[] = [...((log.flags as string[]) ?? [])];

  if (km < openingKm) {
    return { error: `Shaam ka meter (${km.toLocaleString()}) subah ke meter (${openingKm.toLocaleString()}) se kam nahi ho sakta. Photo dobara bhejein.` };
  }

  const kmTravelled = km - openingKm;
  if (kmTravelled > ABNORMAL_KM_PER_DAY) {
    flags.push(`Aaj ${Math.round(kmTravelled).toLocaleString()} km chale — ye mamool se bahut zyada hai.`);
  }
  if (kmTravelled === 0) {
    flags.push("Aaj gaari bilkul nahi chali (subah aur shaam ka meter ek hi hai).");
  }

  const { data: fuelRows } = await service
    .from("vehicle_fuel_entries")
    .select("liters, amount")
    .eq("daily_log_id", log.id);

  const rows = fuelRows ?? [];
  const fuelLiters = rows.reduce((sum, r) => sum + Number(r.liters ?? 0), 0) || null;
  const fuelAmount = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) || null;

  const kmPerLiter = fuelLiters ? Math.round((kmTravelled / fuelLiters) * 100) / 100 : null;
  const costPerKm = fuelAmount && kmTravelled > 0 ? Math.round((fuelAmount / kmTravelled) * 100) / 100 : null;

  // Gaari ki muqarrar mileage ke hisaab se jitna petrol lagna chahiye tha.
  const expectedLiters = vehicle.expectedKmPerLiter > 0 ? Math.round((kmTravelled / vehicle.expectedKmPerLiter) * 100) / 100 : null;
  const litersDifference = expectedLiters != null && fuelLiters != null ? Math.round((fuelLiters - expectedLiters) * 100) / 100 : null;

  if (kmPerLiter != null && vehicle.expectedKmPerLiter > 0) {
    const gap = Math.abs(kmPerLiter - vehicle.expectedKmPerLiter) / vehicle.expectedKmPerLiter;
    if (gap > MILEAGE_TOLERANCE) {
      flags.push(`Mileage ${kmPerLiter} km/litre nikli, jabke is gaari ki mamooli mileage ${vehicle.expectedKmPerLiter} km/litre hai.`);
    }
  }
  if (fuelLiters == null) {
    flags.push("Aaj ka koi petrol ka bill nahi aaya.");
  }

  const now = new Date().toISOString();
  const { error } = await service
    .from("vehicle_daily_logs")
    .update({
      closing_km: km,
      closing_at: now,
      closing_submission_id: submissionId,
      km_travelled: kmTravelled,
      fuel_liters: fuelLiters,
      fuel_amount: fuelAmount,
      km_per_liter: kmPerLiter,
      cost_per_km: costPerKm,
      expected_liters: expectedLiters,
      liters_difference: litersDifference,
      flags: flags as never,
      status: "complete",
      updated_at: now,
    })
    .eq("id", log.id)
    .is("closing_km", null);
  if (error) return { error: error.message };

  return {
    logNumber: log.log_number,
    kmTravelled,
    fuelLiters,
    kmPerLiter,
    expectedLiters,
    litersDifference,
    fuelAmount,
    costPerKm,
    flags,
  };
}
