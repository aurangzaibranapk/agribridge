import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { buildMilkReceiptSms } from "@/lib/utils/milk-formula";
import { sendMilkSms } from "@/lib/sms";
import {
  karachiShift,
  karachiYear2,
  lrRangeError,
  milkInsertConflictMessage,
  rpcError,
} from "@/lib/dairy/rules";

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

/** Entry system mein kaise hui. */
export type MilkChannel = "website" | "offline" | "whatsapp" | "app";
/** Doodh chiller tak kaise pahuncha. */
export type CollectionSource = "mca_field" | "self_delivery";
export type MilkStatus = "pending_fat" | "priced" | "verified" | "rejected";

export const CHANNEL_LABEL: Record<MilkChannel, string> = {
  website: "Website",
  offline: "Offline (baad mein sync)",
  whatsapp: "WhatsApp",
  app: "Mobile App",
};

export const SOURCE_LABEL: Record<CollectionSource, string> = {
  mca_field: "MCA Field Collection",
  self_delivery: "Farmer Self Delivery",
};

export const STATUS_LABEL: Record<MilkStatus, string> = {
  pending_fat: "FAT ka intezar",
  priced: "Rate lag gaya",
  verified: "Manager ne tasdeeq ki",
  rejected: "Rad kar di gayi",
};

/**
 * Manager ke comment ki hadd -- DB ka khana varchar(255) hai, dono ek
 * jaise rahen. Ye yahan hain, action wali file mein nahi: "use server"
 * file se sirf async function bahar ja sakte hain.
 */
/**
 * Jis entry par koi route nahi lagta, us ka group ka naam.
 *
 * Ye DATA hai, screen ka lafz nahi -- entries isi naam ke neeche jama
 * hoti hain. Screen par ise t("mk_no_route") se dikhaya jata hai, warna
 * zaban badalte hi grouping toot jati.
 */
export const NO_ROUTE = "Bagair route";

export const VERIFY_COMMENT_MAX = 255;
export const VERIFY_COMMENT_MIN = 5;

/** LR ki photo ka private bucket -- signed URL ke baghair nahi khulta. */
export const LR_BUCKET = "milk-lr";

async function nextCollectionNumber(now = new Date()): Promise<string | { error: string }> {
  const service = createServiceClient();
  const year = karachiYear2(now);
  const { data, error } = await (service as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("fn_next_milk_collection_number", { p_year: year });
  if (error || typeof data !== "string" || !data) {
    return { error: error ? rpcError(error.message) : "Collection number nahi bana." };
  }
  return data;
}

/**
 * Kisan ka code dhoondna, jaisa MCA likhta hai.
 *
 * Khate mein code "FRM-000002" hota hai, magar maidan mein koi ye poora
 * nahi likhta -- WhatsApp par "Farmer 2" aata hai aur zaban par bhi
 * kisan "do number" hi kehlata hai. Is liye teen tareeqe se dekhte hain:
 * jyon ka tyon, phir FRM wali poori shakal, phir wo code jis ke aakhir
 * mein wahi hindse hon.
 *
 * Andaza yahan bhi nahi lagate: aadha milta hua code mil jaye to bhi
 * sirf wohi manate hain jo poore taur par milta ho, kyunke ghalat kisan
 * ke khate mein doodh chala jana theek karne se kahin mushkil hota hai.
 */
export async function findFarmerByCode(code: string) {
  const service = createServiceClient();
  const raw = code.trim();
  if (!raw) return null;

  const columns = "id, full_name, phone_number, branch_id, farmer_code";

  // ilike, eq nahi: WhatsApp se code chhote haroof mein aata hai
  // ("frm-000002") jabke khate mein bare haroof mein likha hai.
  const { data: exact } = await service.from("farmers").select(columns).ilike("farmer_code", raw).maybeSingle();
  if (exact) return exact;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const padded = digits.padStart(6, "0");

  const { data: framed } = await service
    .from("farmers")
    .select(columns)
    .eq("farmer_code", `FRM-${padded}`)
    .maybeSingle();
  if (framed) return framed;

  // Code ka silsila kal badal sakta hai (FRM- ki jagah kuch aur). Aakhri
  // hindson par milana us tabdeeli ko bardasht kar leta hai.
  const { data: tail } = await service
    .from("farmers")
    .select(columns)
    .ilike("farmer_code", `%${padded}`)
    .limit(2);
  if (tail && tail.length === 1) return tail[0];

  return null;
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
  /** Entry kis raaste se hui. */
  channel: MilkChannel;
  /** Doodh chiller tak kaise pahuncha. Na batayein to MCA wala. */
  collectionSource?: CollectionSource;
  /** Device par bana nishan. Offline sync ki dobara koshish isi se rukti hai. */
  clientUuid?: string | null;
  /** MCA -- self-delivery mein hamesha null. */
  mcaProfileId: string | null;
  /** Self-delivery mein doodh wusool karne wala MCO. */
  receivedByProfileId?: string | null;
  /** Self-delivery par pehla SMS nahi jata -- raqam wala foran ban jata hai. */
  skipInterimSms?: boolean;
  branchId?: string | null;
  routeName?: string | null;
  chillerName?: string | null;
  /** LR ki photo -- base64 mein. */
  lrImage?: { base64: string; mimeType: string } | null;
  notes?: string | null;
  /** Manager ne LR 15–40 se bahar jaan boojh kar mana. */
  qualityOverride?: boolean;
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

  const collectionSource: CollectionSource = input.collectionSource ?? "mca_field";
  const selfDelivery = collectionSource === "self_delivery";

  if (selfDelivery && !input.receivedByProfileId) {
    return { error: "Wusool karne wale MCO ka naam zaroori hai." };
  }
  if (!selfDelivery && !input.mcaProfileId) {
    return { error: "MCA ka naam zaroori hai." };
  }

  // ---- Farmer dhoondein ----
  let farmerId = input.farmerId ?? null;
  let farmerName = "";
  let farmerPhone: string | null = null;
  let farmerBranch: string | null = null;

  if (!farmerId && input.farmerCode) {
    const data = await findFarmerByCode(input.farmerCode);
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

  const entryDate = input.entryDate ?? aajKaKhana();
  const shift = input.shift ?? karachiShift();
  const lrError = lrRangeError(input.lr, Boolean(input.qualityOverride));
  if (lrError) return { error: lrError };

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
    .select("id, collection_number, entry_channel, quantity_liters")
    .eq("farmer_id", farmerId)
    .eq("entry_date", entryDate)
    .eq("shift", shift)
    .neq("status", "rejected")
    .limit(1);

  if (sameShift && sameShift.length > 0) {
    const first = sameShift[0];
    duplicateOf = first.id;
    flags.push(
      `Isi kisan ki isi shift mein pehle se entry maujood hai (${first.collection_number ?? "—"}, ${Number(first.quantity_liters)}L, ${CHANNEL_LABEL[first.entry_channel as MilkChannel] ?? first.entry_channel}).`
    );
  }

  if (input.lr == null) flags.push("LR nahi aaya.");
  if (!input.lrImage) flags.push("LR ki photo nahi aayi.");

  // ---- LR ki photo ----
  // Photo na chadhe to bhi entry banti hai. Saboot ki photo kho jana
  // bura hai, magar poori entry kho dena us se zyada bura.
  const collectionNumber = await nextCollectionNumber();
  if (typeof collectionNumber !== "string") return collectionNumber;
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
      entry_channel: input.channel,
      collection_source: collectionSource,
      // Self-delivery mein MCA ka khana KHALI rehta hai. Kisi MCA ka
      // naam daal dena us ki karkardagi aur us ke route ka nuqsan dono
      // ghalat kar deta hai -- wo doodh us ki gaari mein kabhi aaya hi
      // nahi tha.
      mca_profile_id: selfDelivery ? null : input.mcaProfileId,
      received_by_profile_id: selfDelivery ? (input.receivedByProfileId ?? null) : null,
      client_uuid: input.clientUuid ?? null,
      collection_number: collectionNumber,
      route_name: input.routeName ?? null,
      chiller_name: input.chillerName ?? null,
      lr_image_path: lrImagePath,
      collected_at: input.collectedAt ?? new Date().toISOString(),
      synced_at: new Date().toISOString(),
      possible_duplicate_of: duplicateOf,
      lr_override: Boolean(input.qualityOverride) && input.lr != null && (input.lr < 15 || input.lr > 40),
      flags: flags as never,
      notes: input.notes ?? null,
      created_by: selfDelivery ? (input.receivedByProfileId ?? null) : input.mcaProfileId,
    })
    .select("id, collection_number")
    .single();

  if (error) {
    // client_uuid ka taala -- do sync ek sath aa gaye. Ye ghalti nahi,
    // yahi taale ka kaam hai.
    const conflict = milkInsertConflictMessage(error.code, error.message, (error as { details?: string }).details);
    if (conflict) return { error: conflict };
    return { error: error.message };
  }

  // Kisan ko foran ittila -- raqam nahi, kyunke abhi bani hi nahi.
  if (farmerPhone && !input.skipInterimSms) {
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
  byProfileId: string,
  opts?: { allowOverride?: boolean }
): Promise<FatResult | { error: string }> {
  const service = createServiceClient();

  if (!(fat > 0)) return { error: "FAT sahi likhein." };

  // Ek hi database transaction: lock, rate, khata, wallet, GL.
  // Koi qadam nakaam ho to entry pending_fat hi rehti hai aur doosri
  // dafa credit nahi banta.
  const { data, error } = await (service as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: FatRpcRow | null; error: { message: string } | null }>;
  }).rpc("fn_apply_milk_fat", {
    p_entry_id: entryId,
    p_fat: fat,
    p_by: byProfileId,
    p_allow_override: Boolean(opts?.allowOverride),
  });

  if (error || !data) return { error: error ? rpcError(error.message) : "FAT nahi laga." };

  const result = {
    snf: Number(data.snf),
    ts: Number(data.ts),
    adjustedVolume: Number(data.adjusted_volume),
    amount: Number(data.amount),
  };

  if (data.phone_number) {
    const when = data.collected_at ? new Date(data.collected_at) : new Date();
    await sendMilkSms(
      data.phone_number,
      buildMilkReceiptSms(data.farmer_name ?? "Kisan", when, Number(data.liters), Number(data.fat), Number(data.lr), result)
    );
  }

  return {
    collectionNumber: data.collection_number ?? "",
    snf: result.snf,
    ts: result.ts,
    adjustedVolume: result.adjustedVolume,
    amount: result.amount,
    ratePerLiter: Number(data.rate_per_liter),
  };
}

interface FatRpcRow {
  collection_number: string;
  snf: number;
  ts: number;
  adjusted_volume: number;
  amount: number;
  rate_per_liter: number;
  farmer_name: string | null;
  phone_number: string | null;
  collected_at: string | null;
  liters: number;
  fat: number;
  lr: number;
}

/** Private bucket ki LR photo dekhne ka arzi link. */
export async function signedLrUrl(path: string | null, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const service = createServiceClient();
  const { data } = await service.storage.from(LR_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
