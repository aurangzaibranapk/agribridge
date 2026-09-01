"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { readProductPhoto } from "@/lib/ai/intake-extraction-client";
import { createClient } from "@/lib/supabase/server";

export interface IntakeState {
  error?: string;
  notice?: string;
  success?: boolean;
  itemId?: string;
  batchId?: string;
  created?: number;
  skipped?: number;
}

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

async function gate() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, ok: false };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, ok: !!me?.is_active && ALLOWED.includes(me.role) };
}

const paths = (batchId?: string) => {
  revalidatePath("/admin/products/intake");
  if (batchId) revalidatePath(`/admin/products/intake/${batchId}`);
  revalidatePath("/admin/products");
};

// =====================================================================
// 1) Naya chakkar
// =====================================================================
export async function createIntakeBatch(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Maal andar lena sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Is chakkar ka koi naam likhein — mesalan '3 September ka maal'." };

  const warehouseId = (formData.get("warehouse_id") as string) || null;
  if (!warehouseId) {
    return { error: "Warehouse chunein — maal kahan aayega ye tay hona chahiye." };
  }

  const { data, error } = await supabase
    .from("product_intake_batches")
    .insert({ name, warehouse_id: warehouseId, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  paths();
  return { success: true, batchId: data.id, notice: "Chakkar khul gaya. Ab scan karna shuru karein." };
}

// =====================================================================
// 2) Barcode scan kar ke qatar banana
// =====================================================================
/**
 * Camera se barcode aata hai, aur us ke sath ye bhi ke wo KAHAN SE
 * aaya. Scanner ne lakeerein parhi hain, is liye source = 'scanner'.
 *
 * Check digit yahan bhi jaancha jata hai, browser mein jaanchne ke
 * BAWAJOOD. Browser ki jaanch us bande ko turant bata deti hai; ye
 * jaanch record par baithti hai. Sirf browser par bharosa karna us din
 * tootta hai jis din koi doosra raasta bane.
 */
export async function addScannedItem(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return { error: "Kaun sa chakkar, wo saaf nahi." };

  const raw = String(formData.get("barcode") ?? "");
  const source = String(formData.get("barcode_source") ?? "scanner");
  const code = normalizeBarcode(raw);

  if (!code) return { error: "Barcode khali hai." };
  if (!["scanner", "ai", "manual"].includes(source)) return { error: "Barcode kahan se aaya, ye saaf nahi." };

  const verified = isValidBarcode(code);

  // Ye ROK nahi, khabardari hai. Kuch chhoti company ke dabbon par
  // barcode asli qawaid par nahi hota, aur wo maal bhi bikta hai.
  const warn = verified ? null : "Is barcode ka check digit theek nahi — dobara scan kar ke dekh lein.";

  // Poore nizam mein ye barcode pehle se hai? Ye sawal ABHI poochha
  // jata hai, manzoori ke waqt nahi -- warna banda pachaas qatarein
  // bhar chuka hota hai aur tab pata chalta hai ke aadhi fuzool thin.
  const { data: already } = await supabase
    .from("products")
    .select("id, name")
    .eq("barcode", code)
    .eq("is_deleted", false)
    .maybeSingle();

  if (already) {
    return {
      error: `Ye barcode pehle se "${already.name}" par laga hua hai. Naya product banane ki zaroorat nahi — us ka stock baRhayein.`,
    };
  }

  const { data, error } = await supabase
    .from("product_intake_items")
    .insert({
      batch_id: batchId,
      barcode: code,
      barcode_source: source,
      barcode_verified: verified,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("idx_intake_barcode_once")) {
      return { error: "Ye barcode isi chakkar mein pehle se scan ho chuka hai." };
    }
    return { error: error.message };
  }

  paths(batchId);
  return {
    success: true,
    itemId: data.id,
    batchId,
    notice: warn ?? "Scan ho gaya. Ab dabbe ki tasveer lagayein.",
  };
}

/** Bina barcode ke bhi qatar ban sakti hai -- har dabbe par barcode nahi hota. */
export async function addBlankItem(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return { error: "Kaun sa chakkar, wo saaf nahi." };

  const { data, error } = await supabase
    .from("product_intake_items")
    .insert({ batch_id: batchId })
    .select("id")
    .single();

  if (error) return { error: error.message };

  paths(batchId);
  return { success: true, itemId: data.id, batchId, notice: "Khali qatar ban gayi — tasveer lagayein ya khud bharein." };
}

// =====================================================================
// 3) Tasveer lagana aur AI se parhwana
// =====================================================================
export async function attachPhotoAndRead(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const itemId = String(formData.get("item_id") ?? "");
  const imageUrl = String(formData.get("image_url") ?? "");
  if (!itemId || !imageUrl) return { error: "Tasveer ya qatar saaf nahi." };

  const { data: item } = await supabase
    .from("product_intake_items")
    .select("batch_id, status, name, selling_price")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "Qatar nahi mili." };
  if (item.status === "approved") return { error: "Ye qatar manzoor ho chuki hai — ab nahi badalti." };

  await supabase.from("product_intake_items").update({ image_url: imageUrl }).eq("id", itemId);

  const reading = await readProductPhoto(imageUrl);

  if (!reading) {
    paths(item.batch_id);
    return {
      success: true,
      notice:
        "Tasveer lag gayi, magar AI se parha nahi ja saka (ho sakta hai GEMINI_API_KEY na laga ho). Khane khud bhar lein.",
    };
  }

  // AI ka bhara hua kabhi bande ke likhe hue par NAHI likhta. Jo khana
  // pehle se bhara hai wo waise ka waisa rehta hai -- warna banda
  // theek kar ke tasveer dobara lagaye to us ki mehnat mit jati hai.
  const update: Record<string, unknown> = {
    ai_raw: reading as unknown as Record<string, unknown>,
    ai_read_at: new Date().toISOString(),
  };

  const setIfEmpty = (col: string, current: unknown, value: unknown) => {
    if (value == null) return;
    if (current == null || current === "") update[col] = value;
  };

  const { data: full } = await supabase
    .from("product_intake_items")
    .select("name, brand_name, company_name, category_name, pack_size, unit, manufacture_date, expiry_date, mrp_price, selling_price")
    .eq("id", itemId)
    .single();

  setIfEmpty("name", full?.name, reading.name);
  setIfEmpty("brand_name", full?.brand_name, reading.brand);
  setIfEmpty("company_name", full?.company_name, reading.company);
  setIfEmpty("category_name", full?.category_name, reading.categoryGuess);
  setIfEmpty("pack_size", full?.pack_size, reading.packSize);
  setIfEmpty("unit", full?.unit, reading.unit);
  setIfEmpty("manufacture_date", full?.manufacture_date, reading.manufactureDate);
  setIfEmpty("expiry_date", full?.expiry_date, reading.expiryDate);
  setIfEmpty("mrp_price", full?.mrp_price, reading.printedPrice);

  // Chhapi hui qeemat sale rate mein bhi bhar di jati hai -- dukan
  // aksar wohi lagati hai. Magar SIRF tab jab sale rate khali ho, aur
  // banda usay badal sakta hai.
  setIfEmpty("selling_price", full?.selling_price, reading.printedPrice);

  const { error } = await supabase.from("product_intake_items").update(update).eq("id", itemId);
  if (error) return { error: error.message };

  paths(item.batch_id);

  return {
    success: true,
    notice:
      reading.confidence === "low"
        ? "Tasveer saaf nahi thi — jo bhara gaya hai usay dhyan se dekh lein."
        : "AI ne khane bhar diye. Ek nazar dekh lein.",
  };
}

// =====================================================================
// 4) Qatar theek karna
// =====================================================================
export async function saveIntakeItem(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return { error: "Qatar saaf nahi." };

  const { data: item } = await supabase
    .from("product_intake_items")
    .select("batch_id, status, barcode")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "Qatar nahi mili." };
  if (item.status === "approved") return { error: "Ye qatar manzoor ho chuki hai — ab nahi badalti." };

  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const txt = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const date = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };

  const name = txt("name");
  const sellingPrice = num("selling_price");
  const mfg = date("manufacture_date");
  const exp = date("expiry_date");

  if (exp && mfg && exp < mfg) {
    return { error: "Expiry manufacturing se pehle nahi ho sakti." };
  }

  // Barcode haath se bhi likha ja sakta hai -- magar tab source badal
  // jata hai, taake baad mein pata rahe ke ye scan nahi hua tha.
  const typedBarcode = normalizeBarcode(String(formData.get("barcode") ?? ""));
  const barcodeChanged = typedBarcode !== (item.barcode ?? "");

  const payload: Record<string, unknown> = {
    name,
    brand_name: txt("brand_name"),
    company_name: txt("company_name"),
    category_name: txt("category_name"),
    pack_size: txt("pack_size"),
    unit: txt("unit"),
    manufacture_date: mfg,
    expiry_date: exp,
    mrp_price: num("mrp_price"),
    selling_price: sellingPrice,
    // Thok ka rate NULL reh sakta hai -- har cheez thok par nahi milti.
    wholesale_price: num("wholesale_price"),
    purchase_price: num("purchase_price"),
    opening_qty: num("opening_qty") ?? 0,
    // Naam aur sale rate dono ho to hi ye qatar charhne layak hai.
    status: name && name.length >= 2 && sellingPrice !== null ? "ready" : "draft",
  };

  if (barcodeChanged) {
    payload.barcode = typedBarcode || null;
    payload.barcode_source = typedBarcode ? "manual" : null;
    payload.barcode_verified = typedBarcode ? isValidBarcode(typedBarcode) : null;
  }

  const { error } = await supabase.from("product_intake_items").update(payload).eq("id", itemId);
  if (error) {
    if (error.message.includes("idx_intake_barcode_once")) {
      return { error: "Ye barcode isi chakkar mein kisi aur qatar par laga hua hai." };
    }
    return { error: error.message };
  }

  paths(item.batch_id);
  return { success: true, notice: payload.status === "ready" ? "Mehfooz — ye charhne ke liye tayyar hai." : "Mehfooz. Naam aur sale rate ke baghair ye charh nahi sakti." };
}

export async function skipIntakeItem(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const itemId = String(formData.get("item_id") ?? "");
  const { data: item } = await supabase
    .from("product_intake_items")
    .select("batch_id, status")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { error: "Qatar nahi mili." };
  if (item.status === "approved") return { error: "Manzoor shuda qatar nahi hatti." };

  const { error } = await supabase
    .from("product_intake_items")
    .update({ status: "skipped" })
    .eq("id", itemId);
  if (error) return { error: error.message };

  paths(item.batch_id);
  return { success: true, notice: "Ye qatar chhoR di gayi." };
}

// =====================================================================
// 5) Sab ek sath manzoor -- aur maal warehouse mein
// =====================================================================
/**
 * Yahan teen kaam ek sath hote hain, aur TARTEEB ahem hai:
 *   1. products bante hain
 *   2. inventory mein us warehouse ka khana banta hai (opening_qty)
 *   3. qatarein "approved" ho kar apne product se juR jati hain
 *
 * Ulta karne par qatar "manzoor" dikhti rehti hai jab ke product bana
 * hi nahi -- aur us ka pata kisi ko nahi chalta.
 */
export async function approveIntakeBatch(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Manzoori sirf Owner, Admin ya Warehouse wale de sakte hain." };

  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return { error: "Kaun sa chakkar, wo saaf nahi." };

  const { data: batch } = await supabase
    .from("product_intake_batches")
    .select("id, name, status, warehouse_id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: "Chakkar nahi mila." };
  if (batch.status === "approved") return { error: "Ye chakkar pehle hi manzoor ho chuka hai." };
  if (!batch.warehouse_id) return { error: "Is chakkar ka warehouse darj nahi. Maal kahan aayega, ye tay hona chahiye." };

  const { data: items } = await supabase
    .from("product_intake_items")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "ready");

  const ready = items ?? [];
  if (ready.length === 0) {
    return { error: "Koi qatar charhne ke liye tayyar nahi. Har qatar par naam aur sale rate chahiye." };
  }

  // Aakhri lamhe par dobara dekha jata hai ke koi barcode ya naam is
  // dauran kisi aur raaste se bana to nahi diya gaya.
  const barcodes = ready.map((r) => r.barcode).filter(Boolean) as string[];
  const names = ready.map((r) => (r.name ?? "").trim().toLowerCase());

  const { data: clash } = await supabase
    .from("products")
    .select("name, barcode")
    .eq("is_deleted", false);

  const takenBarcodes = new Set((clash ?? []).map((p) => p.barcode).filter(Boolean) as string[]);
  const takenNames = new Set((clash ?? []).map((p) => p.name.trim().toLowerCase()));

  const skipped: string[] = [];
  const toCreate = ready.filter((r) => {
    const bc = r.barcode as string | null;
    const nm = (r.name ?? "").trim().toLowerCase();
    if (bc && takenBarcodes.has(bc)) {
      skipped.push(`${r.name} (barcode pehle se hai)`);
      return false;
    }
    if (takenNames.has(nm)) {
      skipped.push(`${r.name} (is naam ka product pehle se hai)`);
      return false;
    }
    return true;
  });

  if (toCreate.length === 0) {
    return { error: `Saari qatarein pehle se maujood hain: ${skipped.join(", ")}` };
  }

  const [{ data: categories }, { data: brands }, { data: companies }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("brands").select("id, name"),
    supabase.from("companies").select("id, name"),
  ]);
  const key = (s: string) => s.trim().toLowerCase();
  const catMap = new Map((categories ?? []).map((c) => [key(c.name), c.id]));
  const brandMap = new Map((brands ?? []).map((b) => [key(b.name), b.id]));
  const compMap = new Map((companies ?? []).map((c) => [key(c.name), c.id]));

  const { data: created, error: createErr } = await supabase
    .from("products")
    .insert(
      toCreate.map((r) => ({
        name: (r.name ?? "").trim(),
        barcode: r.barcode,
        pack_size: r.pack_size,
        unit: r.unit,
        manufacture_date: r.manufacture_date,
        expiry_date: r.expiry_date,
        mrp_price: r.mrp_price,
        selling_price: Number(r.selling_price ?? 0),
        wholesale_price: r.wholesale_price,
        // Trade rate na ho to sifar jata hai (khana NOT NULL hai) magar
        // us par nishan lagta hai -- warna wo sifar munafe mein chup
        // chaap juR jata (241).
        purchase_price: Number(r.purchase_price ?? 0),
        trade_rate_pending: r.purchase_price == null,
        image_url: r.image_url,
        category_id: r.category_name ? catMap.get(key(r.category_name)) ?? null : null,
        brand_id: r.brand_name ? brandMap.get(key(r.brand_name)) ?? null : null,
        company_id: r.company_name ? compMap.get(key(r.company_name)) ?? null : null,
        is_verified: true,
        created_by: user.id,
      }))
    )
    .select("id, name");

  if (createErr) return { error: `Products nahi bane, is liye kuch bhi manzoor nahi hua: ${createErr.message}` };

  // Product ka naam se milan -- insert ki tarteeb wohi rehti hai jo
  // bheji gayi thi, magar naam se milana zyada mehfooz hai.
  const idByName = new Map((created ?? []).map((p) => [key(p.name), p.id]));

  const invRows = toCreate
    .map((r) => {
      const pid = idByName.get(key(r.name ?? ""));
      return pid
        ? {
            product_id: pid,
            warehouse_id: batch.warehouse_id as string,
            quantity_on_hand: Number(r.opening_qty ?? 0),
          }
        : null;
    })
    .filter(Boolean) as { product_id: string; warehouse_id: string; quantity_on_hand: number }[];

  if (invRows.length > 0) {
    const { error: invErr } = await supabase.from("inventory").insert(invRows);
    if (invErr) {
      return {
        error: `Products to ban gaye, magar warehouse mein stock ka khana nahi bana: ${invErr.message}. Products ki fehrist dekhein aur stock haath se daalein.`,
      };
    }
  }

  for (const r of toCreate) {
    const pid = idByName.get(key(r.name ?? ""));
    if (pid) {
      await supabase
        .from("product_intake_items")
        .update({ status: "approved", product_id: pid })
        .eq("id", r.id);
    }
  }

  await supabase
    .from("product_intake_batches")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id })
    .eq("id", batchId);

  await logAudit({
    actionType: "create",
    module: "products",
    recordId: batchId,
    recordLabel: batch.name,
    description: `Maal andar: ${toCreate.length} products bane aur warehouse mein aaye${skipped.length ? `, ${skipped.length} chhoRe gaye` : ""}`,
    changes: {
      bane: { pehle: 0, ab: toCreate.length },
      chhoRe_gaye: { pehle: 0, ab: skipped.length },
    },
  });

  paths(batchId);

  return {
    success: true,
    created: toCreate.length,
    skipped: skipped.length,
    notice: skipped.length
      ? `${toCreate.length} products ban gaye aur warehouse mein aa gaye. ${skipped.length} chhoR diye gaye: ${skipped.join(", ")}`
      : `${toCreate.length} products ban gaye aur warehouse mein aa gaye.`,
  };
}
