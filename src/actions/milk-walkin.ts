"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordCollection, applyFat, findFarmerByCode } from "@/lib/milk-collection";
import { logAudit } from "@/lib/audit";
import { requireAction } from "@/lib/access/guard";

/**
 * Kisan khud chiller par doodh le kar aata hai (Walk-in / Self Delivery).
 *
 * Yahan MCA ka koi hissa nahi hota, is liye us ka khana khali rehta hai
 * -- ye sirf ek khubsurti ki baat nahi: kisi MCA ka naam daal dene se us
 * ki karkardagi mein wo doodh gina jata jo us ne uthaya hi nahi, aur us
 * ke route ka nuqsan ghalat nikalta.
 *
 * Doosra farq: yahan MCO wahin LR aur FAT dono naapta hai, is liye entry
 * "FAT ka intezar" par rukti nahi -- raqam usi waqt ban jati hai aur
 * kisan ko poori parchi wahin mil jati hai.
 */

const MCO_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];

export interface WalkInState {
  error?: string;
  success?: boolean;
  receipt?: {
    collectionNumber: string;
    farmerLabel: string;
    liters: number;
    lr: number;
    fat: number;
    ts: number;
    ratePerLiter: number;
    amount: number;
    chiller: string;
  };
}

export interface FarmerMatch {
  id: string;
  farmer_code: string;
  full_name: string;
  village: string | null;
  phone_number: string | null;
  is_active: boolean;
}

async function mco(allowed = MCO_ROLES) {
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
  if (!allowed.includes(profile.role)) return { error: "Aapko is kaam ki ijazat nahi hai." };

  return { userId: user.id, branchId: profile.branch_id, name: profile.full_name ?? "MCO" };
}

/**
 * Kisan dhoondna -- ID, mobile, CNIC ya naam se.
 *
 * Maidan mein kisan ko apni ID aksar yaad nahi hoti, is liye sirf ID par
 * chhorna kaam rok deta hai. Magar len-den hamesha asli Farmer ID par
 * hi jata hai: naam se mila hua kisan bhi pehle apni ID par tay hota
 * hai, tab hi doodh us ke khate mein jata hai.
 */
export async function searchFarmers(query: string): Promise<FarmerMatch[]> {
  const who = await mco();
  if ("error" in who) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const service = createServiceClient();
  const columns = "id, farmer_code, full_name, village, phone_number, is_active";

  // Poora ya adhoora code -- ye sab se pakka raasta hai, is liye pehle.
  const byCode = await findFarmerByCode(q);
  if (byCode) {
    const { data } = await service.from("farmers").select(columns).eq("id", byCode.id).maybeSingle();
    if (data) return [data as FarmerMatch];
  }

  const digits = q.replace(/\D/g, "");
  const matches = new Map<string, FarmerMatch>();

  if (digits.length >= 7) {
    // Mobile aur CNIC dono hindson mein hote hain. Aakhri hindson par
    // milate hain taake 0333... aur +92333... dono chalen.
    const tail = digits.slice(-9);
    const { data } = await service
      .from("farmers")
      .select(columns)
      .or(`phone_number.ilike.%${tail},backup_phone_number.ilike.%${tail},cnic.ilike.%${digits}%`)
      .eq("is_deleted", false)
      .limit(10);
    for (const row of data ?? []) matches.set(row.id, row as FarmerMatch);
  }

  const { data: byName } = await service
    .from("farmers")
    .select(columns)
    .ilike("full_name", `%${q}%`)
    .eq("is_deleted", false)
    .limit(10);
  for (const row of byName ?? []) matches.set(row.id, row as FarmerMatch);

  return [...matches.values()];
}

/**
 * Naya kisan, wahin chiller par.
 *
 * Sirf utna poochha jata hai jitna doodh lene ke liye waqai chahiye.
 * Qatar lagi hoti hai aur baqi tafseel HR/admin baad mein bhar sakta
 * hai; yahan lamba form rakhne ka matlab hota ke MCO kisi purane kisan
 * ke khate mein doodh daal de, sirf form se bachne ke liye.
 */
export async function quickRegisterFarmer(
  _prev: { error?: string; farmerId?: string; farmerCode?: string },
  formData: FormData
): Promise<{ error?: string; farmerId?: string; farmerCode?: string }> {
  const who = await mco();
  if ("error" in who) return { error: who.error };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone_number") ?? "").trim();
  const village = String(formData.get("village") ?? "").trim();

  // Naya kisan banana alag kaam hai -- doodh lene ki ijazat rakhne wala
  // har shakhs khate mein naya naam nahi daal sakta.
  const gate = await requireAction("farmers", "create");
  if ("error" in gate) return { error: gate.error };

  if (fullName.length < 3) return { error: "Poora naam likhein." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Mobile number sahi likhein." };

  const service = createServiceClient();

  // Wohi number pehle se kisi ke paas ho to naya kisan nahi banate --
  // do khate ek hi shakhs ke naam par bann jana baad mein sulajhana
  // bohot mushkil hota hai.
  const tail = phone.replace(/\D/g, "").slice(-9);
  const { data: already } = await service
    .from("farmers")
    .select("id, farmer_code, full_name")
    .ilike("phone_number", `%${tail}`)
    .eq("is_deleted", false)
    .maybeSingle();
  if (already) {
    return { error: `Ye number pehle se ${already.farmer_code} — ${already.full_name} ka hai. Usi ko chunein.` };
  }

  // farmer_code database khud bharta hai (migration 121).
  const { data: org } = await service.from("farmers").select("organization_id").limit(1).maybeSingle();

  const { data, error } = await service
    .from("farmers")
    .insert({
      full_name: fullName,
      phone_number: phone,
      village: village || null,
      branch_id: who.branchId,
      interested_in_milk: true,
      ...(org?.organization_id ? { organization_id: org.organization_id } : {}),
    })
    .select("id, farmer_code")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "farmers",
    recordId: data.id,
    recordLabel: data.farmer_code,
    description: `Chiller par naya kisan darj: ${fullName}`,
  });

  revalidatePath("/admin/farmers");
  return { farmerId: data.id, farmerCode: data.farmer_code };
}

/**
 * Walk-in entry: doodh, LR aur FAT, sab ek hi waqt.
 *
 * Entry pehle banti hai (bagair rate ke), phir usi par FAT lagta hai.
 * Do qadam is liye ke rate aur khate ka hisaab wahi ek jagah rahe jise
 * website, WhatsApp aur offline bhi istemal karte hain -- yahan dobara
 * likhte to ek din formula ek jagah badal jata aur doosri jagah purana
 * chalta rehta.
 */
export async function recordWalkIn(_prev: WalkInState, formData: FormData): Promise<WalkInState> {
  const who = await mco();
  if ("error" in who) return { error: who.error };

  const farmerId = String(formData.get("farmer_id") ?? "");
  const liters = Number(formData.get("liters") ?? 0);
  const lr = Number(formData.get("lr") ?? 0);
  const fat = Number(formData.get("fat_percentage") ?? 0);
  const shift = String(formData.get("shift") ?? "morning");
  const imageBase64 = String(formData.get("lr_image_base64") ?? "");
  const imageMime = String(formData.get("lr_image_mime") ?? "");
  const clientUuid = String(formData.get("client_uuid") ?? "") || null;

  const gate = await requireAction("milk-collection.walk-in", "create");
  if ("error" in gate) return { error: gate.error };

  if (!farmerId) return { error: "Kisan chunein." };
  if (!(liters > 0)) return { error: "Litre sahi likhein." };
  if (!(lr > 0)) return { error: "LR zaroori hai — kisan yahin khara hai, abhi naap lein." };
  if (!(fat > 0) || fat > 15) return { error: "FAT sahi likhein (0 se 15 ke darmiyan)." };

  const service = createServiceClient();
  const { data: staff } = await service
    .from("staff_details")
    .select("milk_chiller_name")
    .eq("profile_id", who.userId)
    .maybeSingle();
  const chiller = staff?.milk_chiller_name ?? "Chiller";

  const saved = await recordCollection({
    farmerId,
    liters,
    lr,
    shift,
    collectionSource: "self_delivery",
    channel: "website",
    clientUuid,
    // MCA ka khana khali. Ye sirf yahan nahi -- database bhi is par
    // pehra deta hai (chk_milk_self_delivery_no_mca).
    mcaProfileId: null,
    receivedByProfileId: who.userId,
    branchId: who.branchId,
    chillerName: chiller,
    lrImage: imageBase64 && imageMime ? { base64: imageBase64, mimeType: imageMime } : null,
    // Pehla SMS nahi jata: FAT abhi lag raha hai, poori parchi lamho
    // mein taiyar hai. Do paighaam bhejna kisan ko sirf uljhata hai.
    skipInterimSms: true,
  });

  if ("error" in saved) return { error: saved.error };
  if (saved.alreadyExisted) return { error: `Ye entry pehle se mahfooz hai — ${saved.collectionNumber}.` };

  const priced = await applyFat(saved.id, fat, who.userId);
  if ("error" in priced) return { error: priced.error };

  await logAudit({
    actionType: "create",
    module: "milk_entries",
    recordId: saved.id,
    recordLabel: saved.collectionNumber,
    description: `Self delivery: ${liters}L, LR ${lr}, FAT ${fat}% — Rs ${priced.amount.toLocaleString()}`,
  });

  revalidatePath("/admin/milk-collection/walk-in");
  revalidatePath("/admin/milk-collection/chiller");

  return {
    success: true,
    receipt: {
      collectionNumber: saved.collectionNumber,
      farmerLabel: saved.farmerName,
      liters,
      lr,
      fat,
      ts: priced.ts,
      ratePerLiter: priced.ratePerLiter,
      amount: priced.amount,
      chiller,
    },
  };
}
