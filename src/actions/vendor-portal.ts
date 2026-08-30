"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyRoles } from "@/lib/notifications";

/**
 * Vendor ka apna raasta.
 *
 * Vendor hamara mulazim nahi -- wo doosri taraf ka bandobast hai. Us ko
 * wo sab kuch dikhana jo staff dekhta hai ghalat hoga (doosre vendors ka
 * kaam, hamara commission ka hisaab, kisan ke paise). Is liye ye file
 * jaan boojh kar chhoti hai: vendor sirf apna kaam bhej sakta hai aur
 * apna khata dekh sakta hai.
 *
 * Aur us ka bheja hua kaam SEEDHA record nahi banta. Wajah ilzam nahi,
 * bunyad hai: bill se vendor ka apna hissa nikalta hai, yani wo apne hi
 * paise ka adad likh raha hota hai. Jis se paisa milna ho wo apni raqam
 * khud tay nahi karta. Is liye us ka indraj dawa rehta hai jab tak
 * hamari team dekh na le (migration 150 mein yehi rok DB par bhi hai).
 */

export interface VendorActionState {
  error?: string;
  success?: boolean;
  notice?: string;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const v = raw === null ? "" : String(raw).trim();
  return v === "" ? null : v;
}

export async function submitVendorWork(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { error: "Ye login kisi vendor se juda hua nahi hai." };

  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking chunein." };

  const acres = num(formData, "actual_area_acres");
  const kanal = num(formData, "actual_area_kanal");
  const area = (acres ?? 0) + (kanal ?? 0) / 8;
  if (area <= 0) return { error: "Kitne acre kaate, wo likhein." };

  // Booking waqai isi vendor ki hai? DB par bhi yehi rok hai, magar
  // yahan se saaf jawab milta hai -- wahan se sirf "policy" ka error.
  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.vendor_id !== vendor.id) {
    return { error: "Ye booking aap ki machine ki nahi hai." };
  }

  const workDate = str(formData, "work_date") ?? new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("machinery_work_records").insert({
    booking_id: bookingId,
    work_date: workDate,
    is_final: formData.get("is_final") === "on",
    actual_area_acres: acres,
    actual_area_kanal: kanal,
    started_at: str(formData, "started_at"),
    finished_at: str(formData, "finished_at"),
    meter_reading: num(formData, "meter_reading"),
    completion_photo_url: str(formData, "completion_photo_url"),
    notes: str(formData, "notes"),
    source: "vendor",
    verification_status: "claimed",
    submitted_by: user.id,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Vendor ne kaam darj kiya — tasdeeq baqi",
    `${vendor.vendor_name} ne booking ${booking.booking_number} par ${area} acre darj kiya hai.`,
    "/admin/machinery-rental/work-claims"
  );

  revalidatePath("/vendor");
  return {
    success: true,
    notice:
      "Aap ka indraj pohanch gaya. Hamari team dekh kar tasdeeq karegi — us ke baad ye bill ka hissa banega.",
  };
}

/**
 * Vendor ka diesel.
 *
 * Khata yahan NAHI poochha jata: vendor ko pata hi nahi hota ke ART ne
 * kis khate se paisa nikala. Wo sawal tasdeeq ke waqt ka hai. Yahan tak
 * ka indraj sirf ye kehta hai ke itna diesel dala aur kis ne dala.
 */
export async function submitVendorFuel(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { error: "Ye login kisi vendor se juda hua nahi hai." };

  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking chunein." };

  const amount = num(formData, "amount") ?? 0;
  const paidBy = str(formData, "paid_by");
  if (amount <= 0) return { error: "Diesel ki raqam likhein." };
  if (!paidBy) return { error: "Diesel kis ne dala, wo batayein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.vendor_id !== vendor.id) {
    return { error: "Ye booking aap ki machine ki nahi hai." };
  }

  const { error } = await supabase.from("machinery_fuel_logs").insert({
    booking_id: bookingId,
    log_date: str(formData, "log_date") ?? new Date().toISOString().slice(0, 10),
    litres: num(formData, "litres"),
    amount,
    paid_by: paidBy,
    notes: str(formData, "notes"),
    source: "vendor",
    verification_status: "claimed",
    submitted_by: user.id,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Vendor ne diesel darj kiya — tasdeeq baqi",
    `${vendor.vendor_name} ne booking ${booking.booking_number} par Rs ${amount.toLocaleString()} ka diesel darj kiya hai.`,
    "/admin/machinery-rental/work-claims"
  );

  revalidatePath("/vendor");
  return {
    success: true,
    notice: "Diesel ka indraj pohanch gaya. Hamari team dekh kar tasdeeq karegi.",
  };
}
