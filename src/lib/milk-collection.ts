import { createServiceClient } from "@/lib/supabase/service";
import { calculateMilkValue, buildMilkReceiptSms } from "@/lib/utils/milk-formula";
import { sendMilkSms } from "@/lib/sms";
import { postFarmerLedger, postFarmerWallet } from "@/lib/farmer-ledger";

/**
 * Doodh jama karne ka WAHID engine.
 *
 * Doodh chaar raaston se aata hai -- website, offline (baad mein sync),
 * WhatsApp, aur aage chal kar Play Store wali app. Chaaron yahi function
 * bulate hain. Agar har raaste ka apna hisaab hota to ek din rate ka
 * formula ek jagah badalta aur baqi teen purane hisaab par chalte rehte,
 * aur farq mahine baad kisi report mein pakra jata -- jab tak paisa ada
 * ho chuka hota.
 *
 * Do halaton mein baant kar rakha gaya hai, jaan boojh kar:
 *
 *   recordCollection()  -- maidan mein: sirf litre, LR aur photo.
 *                          Koi rate, koi raqam, koi ledger.
 *   applyFat()          -- chiller par: FAT lagta hai, tab rate bharta
 *                          hai aur tab farmer ke khate mein jata hai.
 *
 * Ye taqseem asal kaam ki naql hai. MCA ke paas FAT naapne ka aala nahi
 * hota; wo sirf doodh uthata hai. Pehle agar hum yahin rate laga dete to
 * wo andaza hota, aur andaze par bana khata baad mein theek karna parta.
 */

export type MilkSource = "website" | "offline" | "whatsapp" | "app";
export type MilkStatus = "pending_fat" | "priced" | "verified" | "rejected";

export const SOURCE_LABEL: Record<MilkSource, string> = {
  website: "Website",
  offline: "Offline (baad mein sync)",
  whatsapp: "WhatsApp",
  app: "Mobile App",
};

export const STATUS_LABEL: Record<MilkStatus, string> = {
  pending_fat: "FAT ka intezar",
  priced: "Rate lag gaya",
  verified: "Manager ne tasdeeq ki",
  rejected: "Rad kar di gayi",
};

/** LR ki photo ka private bucket -- signed URL ke baghair nahi khulta. */
export const LR_BUCKET = "milk-lr";

async function nextCollectionNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await service
    .from("milk_collection_counters")
    .select("last_number")
    .eq("year", year)
    .maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await service.from("milk_collection_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("milk_collection_counters").insert({ year, last_number: next });
  }

  return `MC-${year}-${String(next).padStart(6, "0")}`;
}

export interface CollectionInput {
  /** Farmer ka code (WhatsApp par "Farmer 2") ya seedha id. */
  farmerId?: string | null;
  farmerCode?: string | null;
  liters: number;
  lr: number | null;
  shift?: string;
  entryDate?: string;
  /** Kis waqt asal mein jama hua -- offline mein sync ke waqt se alag hota hai. */
  collectedAt?: string | null;
  source: MilkSource;
  /** Device par bana nishan. Offline sync ki dobara koshish isi se rukti hai. */
  clientUuid?: string | null;
  mcaProfileId: string | null;
  branchId?: string | null;
  routeName?: string | null;
  chillerName?: string | null;
  /** LR ki photo -- base64 mein. */
  lrImage?: { base64: string; mimeType: string } | null;
  notes?: string | null;
}

export interface CollectionSaved {
  id: string;
  collectionNumber: string;
  farmerName: string;
  liters: number;
  /** Pehle se maujood entry mili -- kuch naya nahi bana. */
  alreadyExisted: boolean;
  flags: string[];
}

export type CollectionResult = CollectionSaved | { error: string };

/**
 * Maidan se aayi hui entry. Yahan koi rate nahi lagta aur koi paisa
 * kisi khate mein nahi jata -- wo sab FAT ke baad hota hai.
 */
export async function recordCollection(input: CollectionInput): Promise<CollectionResult> {
  const service = createServiceClient();

  if (!(input.liters > 0)) return { error: "Litre sahi likhein." };

  // ---- Farmer dhoondein ----
  let farmerId = input.farmerId ?? null;
  let farmerName = "";
  let farmerPhone: string | null = null;
  let farmerBranch: string | null = null;

  if (!farmerId && input.farmerCode) {
    const { data } = await service
      .from("farmers")
      .select("id, full_name, phone_number, branch_id")
      .eq("farmer_code", input.farmerCode.trim())
      .maybeSingle();
    if (!data) return { error: `Farmer code "${input.farmerCode}" ka koi kisan nahi mila.` };
    farmerId = data.id;
    farmerName = data.full_name ?? "";
    farmerPhone = data.phone_number;
    farmerBranch = data.branch_id;
  } else if (farmerId) {
    const { data } = await service
      .from("farmers")
      .select("id, full_name, phone_number, branch_id")
      .eq("id", farmerId)
      .maybeSingle();
    if (!data) return { error: "Farmer nahi mila." };
    farmerName = data.full_name ?? "";
    farmerPhone = data.phone_number;
    farmerBranch = data.branch_id;
  }

  if (!farmerId) return { error: "Farmer batana zaroori hai." };

  const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);
  const shift = input.shift ?? (new Date().getHours() < 14 ? "morning" : "evening");

  // ---- Pehle se to nahi aa chuki? ----
  // Offline mein network toot jane par ek hi entry kai dafa bheji jati
  // hai. client_uuid par taala laga hua hai, magar us se pehle yahan
  // dekh lete hain taake user ko ghalti ki jagah pehli entry ka jawab
  // mile.
  if (input.clientUuid) {
    const { data: already } = await service
      .from("milk_entries")
      .select("id, collection_number, quantity_liters")
      .eq("client_uuid", input.clientUuid)
      .maybeSingle();
    if (already) {
      return {
        id: already.id,
        collectionNumber: already.collection_number ?? "",
        farmerName,
        liters: Number(already.quantity_liters),
        alreadyExisted: true,
        flags: [],
      };
    }
  }

  // ---- Milta julta record -- roka nahi jata, nishan lagta hai ----
  // Ek hi kisan ka ek hi shift mein do dafa doodh dena mumkin hai, is
  // liye ise rokna ghalat hoga. Magar teen raaston se ek hi collection
  // do dafa darj ho jana bhi utna hi mumkin hai. Faisla manager ka --
  // hum sirf saamne rakh dete hain.
  const flags: string[] = [];
  let duplicateOf: string | null = null;

  const { data: sameShift } = await service
    .from("milk_entries")
    .select("id, collection_number, source, quantity_liters")
    .eq("farmer_id", farmerId)
    .eq("entry_date", entryDate)
    .eq("shift", shift)
    .neq("status", "rejected")
    .limit(1);

  if (sameShift && sameShift.length > 0) {
    const first = sameShift[0];
    duplicateOf = first.id;
    flags.push(
      `Isi kisan ki isi shift mein pehle se entry maujood hai (${first.collection_number ?? "—"}, ${Number(first.quantity_liters)}L, ${SOURCE_LABEL[first.source as MilkSource] ?? first.source}).`
    );
  }

  if (input.lr == null) flags.push("LR nahi aaya.");
  if (!input.lrImage) flags.push("LR ki photo nahi aayi.");

  // ---- LR ki photo ----
  // Photo na chadhe to bhi entry banti hai. Saboot ki photo kho jana
  // bura hai, magar poori entry kho dena us se zyada bura.
  const collectionNumber = await nextCollectionNumber();
  let lrImagePath: string | null = null;
  if (input.lrImage) {
    const ext = input.lrImage.mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `${entryDate}/${collectionNumber}.${ext}`;
    const bytes = Buffer.from(input.lrImage.base64, "base64");
    const { error } = await service.storage
      .from(LR_BUCKET)
      .upload(path, bytes, { contentType: input.lrImage.mimeType, upsert: false });
    if (error) flags.push("LR ki photo mahfooz nahi ho saki.");
    else lrImagePath = path;
  }

  const { data, error } = await service
    .from("milk_entries")
    .insert({
      farmer_id: farmerId,
      branch_id: input.branchId ?? farmerBranch,
      entry_date: entryDate,
      shift,
      quantity_liters: input.liters,
      lr: input.lr,
      // Rate aur raqam jaan boojh kar khali. FAT ke baghair ye sirf
      // andaza hote, aur andaze par bana khata baad mein theek karna
      // parta.
      rate_per_liter: null,
      total_amount: null,
      status: "pending_fat",
      source: input.source,
      client_uuid: input.clientUuid ?? null,
      collection_number: collectionNumber,
      mca_profile_id: input.mcaProfileId,
      route_name: input.routeName ?? null,
      chiller_name: input.chillerName ?? null,
      lr_image_path: lrImagePath,
      collected_at: input.collectedAt ?? new Date().toISOString(),
      synced_at: new Date().toISOString(),
      possible_duplicate_of: duplicateOf,
      flags: flags as never,
      notes: input.notes ?? null,
      created_by: input.mcaProfileId,
    })
    .select("id, collection_number")
    .single();

  if (error) {
    // client_uuid ka taala -- do sync ek sath aa gaye. Ye ghalti nahi,
    // yahi taale ka kaam hai.
    if (error.code === "23505") {
      return { error: "Ye entry pehle se mahfooz ho chuki hai." };
    }
    return { error: error.message };
  }

  // Kisan ko foran ittila -- raqam nahi, kyunke abhi bani hi nahi.
  if (farmerPhone) {
    await sendMilkSms(
      farmerPhone,
      `AgriBridge: ${input.liters} litre doodh mausool hua (${collectionNumber}).\n` +
        `FAT lagne ke baad raqam ka paighaam alag se aayega.`
    );
  }

  return {
    id: data.id,
    collectionNumber: data.collection_number ?? collectionNumber,
    farmerName,
    liters: input.liters,
    alreadyExisted: false,
    flags,
  };
}

export interface FatResult {
  collectionNumber: string;
  snf: number;
  ts: number;
  adjustedVolume: number;
  amount: number;
  ratePerLiter: number;
}

/**
 * Chiller par FAT lagta hai -- ab rate ban sakta hai.
 *
 * Yahi wo lamha hai jab paisa farmer ke khate mein jata hai. Is se
 * pehle entry maujood to thi, magar us ki koi qeemat nahi thi.
 */
export async function applyFat(
  entryId: string,
  fat: number,
  byProfileId: string
): Promise<FatResult | { error: string }> {
  const service = createServiceClient();

  if (!(fat > 0)) return { error: "FAT sahi likhein." };

  const { data: entry } = await service
    .from("milk_entries")
    .select("id, collection_number, farmer_id, quantity_liters, lr, entry_date, shift, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry nahi mili." };
  if (entry.status !== "pending_fat") return { error: "Is par FAT pehle hi lag chuka hai." };
  if (entry.lr == null) return { error: "LR ke baghair rate nahi ban sakta -- pehle LR bharein." };

  const { data: farmer } = await service
    .from("farmers")
    .select("full_name, phone_number, milk_collection_type")
    .eq("id", entry.farmer_id)
    .maybeSingle();
  if (!farmer) return { error: "Farmer nahi mila." };

  const { data: settings } = await service
    .from("milk_rate_settings")
    .select("standard_rate, self_dropoff_incentive, snf_constant, reference_ts")
    .limit(1)
    .maybeSingle();

  const standardRate = Number(settings?.standard_rate ?? 145);
  const incentive = Number(settings?.self_dropoff_incentive ?? 10);
  const snfConstant = Number(settings?.snf_constant ?? 0.805);
  const referenceTs = Number(settings?.reference_ts ?? 13);

  const effectiveRate = farmer.milk_collection_type === "self_dropoff" ? standardRate + incentive : standardRate;
  const liters = Number(entry.quantity_liters);
  const lr = Number(entry.lr);
  const result = calculateMilkValue(liters, fat, lr, effectiveRate, snfConstant, referenceTs);

  // Halat pehle badalti hai. Agar khate ki entry nakaam ho jaye to
  // update wapas mor diya jata hai -- adhoori soorat (rate lag gaya
  // magar khate mein kuch nahi gaya) sab se buri hoti hai, kyunke wo
  // kisi report mein nazar nahi aati.
  const { error: updateError } = await service
    .from("milk_entries")
    .update({
      fat_percentage: fat,
      snf_percentage: result.snf,
      ts_value: result.ts,
      adjusted_volume: result.adjustedVolume,
      rate_per_liter: effectiveRate,
      total_amount: result.amount,
      status: "priced",
      fat_by_profile_id: byProfileId,
      fat_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("status", "pending_fat");

  if (updateError) return { error: updateError.message };

  const label = `Milk: ${liters}L, Fat ${fat}%, ${entry.entry_date} (${entry.shift}) — ${entry.collection_number}`;

  const ledger = await postFarmerLedger({
    farmerId: entry.farmer_id,
    sourceType: "milk",
    ledgerType: "credit",
    amount: result.amount,
    notes: label,
    referenceId: entryId,
    createdBy: byProfileId,
  });

  if (ledger.error) {
    await service
      .from("milk_entries")
      .update({
        fat_percentage: null,
        snf_percentage: null,
        ts_value: null,
        adjusted_volume: null,
        rate_per_liter: null,
        total_amount: null,
        status: "pending_fat",
        fat_by_profile_id: null,
        fat_at: null,
      })
      .eq("id", entryId);
    return { error: `Khate mein nahi ja saka: ${ledger.error}` };
  }

  await postFarmerWallet({
    farmerId: entry.farmer_id,
    type: "milk_income",
    direction: "credit",
    amount: result.amount,
    notes: label,
    referenceType: "milk_entry",
    referenceId: entryId,
    createdBy: byProfileId,
  });

  if (farmer.phone_number) {
    await sendMilkSms(
      farmer.phone_number,
      buildMilkReceiptSms(farmer.full_name ?? "Kisan", new Date(entry.entry_date), liters, fat, lr, result)
    );
  }

  return {
    collectionNumber: entry.collection_number ?? "",
    snf: result.snf,
    ts: result.ts,
    adjustedVolume: result.adjustedVolume,
    amount: result.amount,
    ratePerLiter: effectiveRate,
  };
}

/** Private bucket ki LR photo dekhne ka arzi link. */
export async function signedLrUrl(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const service = createServiceClient();
  const { data } = await service.storage.from(LR_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
