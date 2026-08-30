"use server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Kisan ka apna raasta.
 *
 * Yahan har cheez service ke haath se hoti hai -- yani DB ka koi
 * pehra nahi lagta. Is liye PEHRA YAHIN HAI, aur us ka ek hi usool
 * hai:
 *
 *   Kaun sa kisan hai, ye HAMESHA token se nikalta hai. Kabhi form se
 *   nahi.
 *
 *   Form se farmer_id lena is poore darwaze ko khol dena hai: koi bhi
 *   kisi doosre ka number likh kar us ke khet, us ki bookings aur us
 *   ka bill dekh leta.
 *
 * Aur doosra usool: kisan sirf apni cheezein likhta hai -- khet,
 * fasal, raqba, tareekh. Rate, bill, tasdeeq aur paisa staff ke paas
 * rehta hai. Kisan ka "20,000 diye" keh dena DAWA hai, hisaab nahi.
 */

export interface PublicBookingState {
  error?: string;
  success?: boolean;
  farmerName?: string;
  notice?: string;
}

type Service = ReturnType<typeof createServiceClient>;

/** Token se kisan -- har cheez ka darwaza yahi hai. */
async function farmerFromToken(service: Service, token: string) {
  if (!token) return null;
  const { data } = await service
    .from("farmers")
    .select("id, full_name, farmer_code, phone_number, village, district")
    .eq("booking_link_token", token)
    .maybeSingle();
  return data ?? null;
}

export async function getFarmerByBookingToken(token: string) {
  const service = createServiceClient();
  return farmerFromToken(service, token);
}

export interface PortalFarm {
  id: string;
  name: string;
  areaAcres: number;
  village: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  capturedAt: string | null;
  source: string | null;
  verified: boolean;
}

export interface PortalBooking {
  bookingId: string;
  bookingNumber: string;
  bookingDate: string;
  harvestDate: string | null;
  cropType: string | null;
  area: number;
  machineType: string | null;
  rate: number | null;
  rateStatus: string;
  workState: string;
  payState: string;
  billNumber: string | null;
  gross: number | null;
  advance: number;
  received: number;
  outstanding: number;
}

/**
 * Kisan ka poora safha ek hi baar mein.
 *
 * Khet, chali hui bookings ka haal, aur wo darkhwastein jo abhi
 * booking nahi bani. Teenon ek sath, kyunke kisan ke liye ye teen
 * safhe nahi hain -- ek hi sawal hai: "meri kattai ka kya bana?"
 */
export async function getFarmerPortal(token: string): Promise<{
  farmer: { id: string; full_name: string; farmer_code: string | null; village: string | null } | null;
  farms: PortalFarm[];
  bookings: PortalBooking[];
  pendingRequests: Array<{ id: string; machineType: string; acres: number | null; expectedDate: string | null; createdAt: string }>;
}> {
  const service = createServiceClient();
  const farmer = await farmerFromToken(service, token);
  if (!farmer) return { farmer: null, farms: [], bookings: [], pendingRequests: [] };

  const [{ data: farms }, { data: bookings }, { data: requests }] = await Promise.all([
    service
      .from("farms")
      .select(
        "id, name, area_acres, village, latitude, longitude, location_accuracy_m, location_captured_at, location_source, is_verified"
      )
      .eq("farmer_id", farmer.id)
      .order("created_at"),
    service
      .from("v_machinery_farmer_status")
      .select("*")
      .eq("farmer_id", farmer.id)
      .order("booking_date", { ascending: false }),
    service
      .from("machinery_requests")
      .select("id, machine_type, machine_type_other, acres, expected_date, created_at")
      .eq("farmer_id", farmer.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  return {
    farmer: {
      id: farmer.id,
      full_name: farmer.full_name ?? "",
      farmer_code: farmer.farmer_code ?? null,
      village: farmer.village ?? null,
    },
    farms: (farms ?? []).map((f) => ({
      id: f.id as string,
      name: (f.name as string) ?? "-",
      areaAcres: Number(f.area_acres ?? 0),
      village: (f.village as string | null) ?? null,
      lat: f.latitude === null ? null : Number(f.latitude),
      lng: f.longitude === null ? null : Number(f.longitude),
      accuracyM: f.location_accuracy_m === null ? null : Number(f.location_accuracy_m),
      capturedAt: (f.location_captured_at as string | null) ?? null,
      source: (f.location_source as string | null) ?? null,
      verified: Boolean(f.is_verified),
    })),
    bookings: (bookings ?? []).map((b) => ({
      bookingId: b.booking_id as string,
      bookingNumber: (b.booking_number as string) ?? "-",
      bookingDate: b.booking_date as string,
      harvestDate: (b.preferred_date as string | null) ?? null,
      cropType: (b.crop_type as string | null) ?? null,
      area: Number(b.harvest_area ?? 0),
      machineType: (b.machine_type as string | null) ?? null,
      rate: b.final_rate === null ? null : Number(b.final_rate),
      rateStatus: (b.rate_status as string) ?? "estimated",
      workState: (b.kaam_ki_halat as string) ?? "nayi",
      payState: (b.paise_ki_halat as string) ?? "bill_nahi_bana",
      billNumber: (b.bill_number as string | null) ?? null,
      gross: b.gross_amount === null ? null : Number(b.gross_amount),
      advance: Number(b.advance_mila ?? 0),
      received: Number(b.ab_tak_mila ?? 0),
      outstanding: Number(b.baqi ?? 0),
    })),
    pendingRequests: (requests ?? []).map((r) => ({
      id: r.id as string,
      machineType: (r.machine_type as string) === "other" ? ((r.machine_type_other as string) ?? "-") : ((r.machine_type as string) ?? "-"),
      acres: r.acres === null ? null : Number(r.acres),
      expectedDate: (r.expected_date as string | null) ?? null,
      createdAt: r.created_at as string,
    })),
  };
}

/**
 * Naya khet -- kisan ke apne haath se.
 *
 * Jagah ke sath us ki SEHAT bhi mehfooz hoti hai: kitne meter ka
 * andaza, kab li gayi, aur kis ne li. Sirf do adad rakh lena kaafi
 * nahi -- 5 meter ka pin aur 500 meter ka pin dekhne mein ek jaise
 * hote hain, aur machine bhejne wale ke liye wo farq sab kuch hai.
 *
 * Kisan ka daala hua khet ghair-tasdeeq shuda rehta hai. Ye us par
 * shak nahi -- wo khet par khara ho kar pin karta hai, hum se behtar.
 * Magar record par ye likha hona chahiye ke ye number kis ka hai.
 */
export async function addFarmByToken(_prev: PublicBookingState, formData: FormData): Promise<PublicBookingState> {
  const service = createServiceClient();
  const farmer = await farmerFromToken(service, String(formData.get("token") ?? ""));
  if (!farmer) return { error: "یہ لنک اب کام نہیں کر رہا۔" };

  const name = String(formData.get("farm_name") ?? "").trim();
  const acres = Number(formData.get("farm_acres") ?? 0);
  const village = String(formData.get("farm_village") ?? "").trim();
  const lat = formData.get("farm_lat") ? Number(formData.get("farm_lat")) : null;
  const lng = formData.get("farm_lng") ? Number(formData.get("farm_lng")) : null;
  const accuracy = formData.get("farm_accuracy") ? Number(formData.get("farm_accuracy")) : null;
  const manual = formData.get("farm_manual") === "yes";

  if (!name) return { error: "کھیت کا نام لکھیں۔" };
  if (!acres || acres <= 0) return { error: "کھیت کے ایکڑ لکھیں۔" };

  const { error } = await service.from("farms").insert({
    farmer_id: farmer.id,
    name,
    area_acres: acres,
    village: village || farmer.village || null,
    district: farmer.district ?? null,
    latitude: lat,
    longitude: lng,
    location_accuracy_m: accuracy,
    location_captured_at: lat !== null && lng !== null ? new Date().toISOString() : null,
    location_source: lat === null || lng === null ? null : manual ? "farmer_manual" : "farmer",
    is_verified: false,
  });
  if (error) return { error: error.message };

  return { success: true, notice: `${name} محفوظ ہو گیا۔` };
}

/**
 * Pin theek karna.
 *
 * GPS kabhi kuch meter idhar-udhar ho jata hai, aur khet ka kinara
 * sarak se dikhta hai. Kisan naqshe par khud theek kar sakta hai --
 * aur us soorat mein "kis ne li" badal jata hai, kyunke haath se
 * lagaya hua pin aur khet par khare ho kar liya gaya pin ek cheez
 * nahi hain.
 */
export async function updateFarmLocationByToken(
  _prev: PublicBookingState,
  formData: FormData
): Promise<PublicBookingState> {
  const service = createServiceClient();
  const farmer = await farmerFromToken(service, String(formData.get("token") ?? ""));
  if (!farmer) return { error: "یہ لنک اب کام نہیں کر رہا۔" };

  const farmId = String(formData.get("farm_id") ?? "");
  const lat = formData.get("farm_lat") ? Number(formData.get("farm_lat")) : null;
  const lng = formData.get("farm_lng") ? Number(formData.get("farm_lng")) : null;
  const accuracy = formData.get("farm_accuracy") ? Number(formData.get("farm_accuracy")) : null;
  const manual = formData.get("farm_manual") === "yes";
  if (!farmId) return { error: "کھیت منتخب نہیں ہوا۔" };
  if (lat === null || lng === null) return { error: "مقام حاصل نہیں ہوا۔" };

  // Khet isi kisan ka hai ya nahi -- ye shart update ke andar hai,
  // sirf poochh kar nahi. Do alag qadam ke darmiyan cheezein badal
  // sakti hain.
  const { data: updated, error } = await service
    .from("farms")
    .update({
      latitude: lat,
      longitude: lng,
      location_accuracy_m: accuracy,
      location_captured_at: new Date().toISOString(),
      location_source: manual ? "farmer_manual" : "farmer",
      is_verified: false,
    })
    .eq("id", farmId)
    .eq("farmer_id", farmer.id)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "یہ کھیت آپ کا نہیں ہے۔" };

  return { success: true, notice: "مقام محفوظ ہو گیا۔" };
}

/**
 * Booking ki darkhwast.
 *
 * Ek darkhwast ek KHET ki hoti hai. Kisan ke teen khet hon to teen
 * darkhwastein banti hain -- ye takleef nahi, sach hai: machine ek
 * jagah jati hai, bill ek raqbe ka banta hai, aur ek machine ek din
 * mein 15 acre karti hai. Teen khet ek darkhwast mein daal dene se
 * ye teenon baatein kahin darj hi nahi hoteen.
 *
 * Advance ka dawa yahan sirf DAWA hai. Wo kisi khate mein nahi jata
 * aur bill ko nahi kaatta jab tak koi bandah tasdeeq na kar de --
 * warna "20,000 diye" keh dene se bill kam ho jaya karega.
 */
export async function submitPublicMachineryRequest(
  _prev: PublicBookingState,
  formData: FormData
): Promise<PublicBookingState> {
  const service = createServiceClient();
  const farmer = await farmerFromToken(service, String(formData.get("token") ?? ""));
  if (!farmer) return { error: "یہ لنک اب کام نہیں کر رہا۔" };

  const machineType = String(formData.get("machine_type") ?? "");
  const machineTypeOther = String(formData.get("machine_type_other") ?? "").trim();
  const expectedDate = String(formData.get("expected_date") ?? "");
  const cropType = String(formData.get("crop_type") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const willSellToUs = formData.get("will_sell_to_us") === "yes";
  const wantsReminder = formData.get("wants_next_season_reminder") === "yes";
  const fieldReady = String(formData.get("field_ready") ?? "").trim();
  const harvestReady = String(formData.get("harvest_ready") ?? "").trim();

  if (!machineType) return { error: "مشین منتخب کریں۔" };
  if (machineType === "other" && !machineTypeOther) return { error: "مشین کا نام لکھیں۔" };
  if (!expectedDate) return { error: "تاریخ منتخب کریں۔" };

  const farmIds = formData.getAll("farm_ids").map(String).filter(Boolean);
  if (farmIds.length === 0) return { error: "کم از کم ایک کھیت منتخب کریں۔" };

  // Sirf isi kisan ke khet. Form mein aaya hua koi bhi ID yahin ruk
  // jata hai -- warna koi doosre ke khet par apni booking bhej deta.
  const { data: farms } = await service
    .from("farms")
    .select("id, name, area_acres, village, latitude, longitude")
    .eq("farmer_id", farmer.id)
    .in("id", farmIds);

  if (!farms || farms.length === 0) return { error: "کھیت نہیں ملے۔" };

  const advanceAmount = formData.get("advance_amount") ? Number(formData.get("advance_amount")) : null;
  const advanceMethod = String(formData.get("advance_method") ?? "").trim();
  const advanceReference = String(formData.get("advance_reference") ?? "").trim();
  const advanceProof = String(formData.get("advance_proof_url") ?? "").trim();

  const rows = farms.map((f, i) => ({
    farmer_id: farmer.id,
    farm_id: f.id,
    machine_type: machineType,
    machine_type_other: machineType === "other" ? machineTypeOther : null,
    acres: Number(f.area_acres ?? 0) || null,
    expected_date: expectedDate,
    crop_type: cropType || null,
    location_lat: f.latitude,
    location_lng: f.longitude,
    location_address: [f.name, f.village].filter(Boolean).join(" — ") || null,
    will_sell_to_us: willSellToUs,
    wants_next_season_reminder: wantsReminder,
    field_ready: fieldReady || null,
    harvest_ready: harvestReady || null,
    notes: notes || null,
    // Advance ka dawa sirf PEHLI darkhwast par. Teen khet chunne se
    // ek hi 20,000 teen dafa dawe mein nahi aana chahiye.
    advance_claimed_amount: i === 0 && advanceAmount && advanceAmount > 0 ? advanceAmount : null,
    advance_claimed_method: i === 0 && advanceAmount && advanceAmount > 0 ? advanceMethod || "cash" : null,
    advance_claimed_reference: i === 0 && advanceAmount && advanceAmount > 0 ? advanceReference || null : null,
    advance_proof_url: i === 0 && advanceAmount && advanceAmount > 0 ? advanceProof || null : null,
  }));

  const { error } = await service.from("machinery_requests").insert(rows);
  if (error) return { error: error.message };

  return {
    success: true,
    farmerName: farmer.full_name ?? undefined,
    notice:
      rows.length === 1
        ? "بکنگ کی درخواست بھیج دی گئی۔"
        : `${rows.length} کھیتوں کی درخواستیں بھیج دی گئیں۔`,
  };
}
