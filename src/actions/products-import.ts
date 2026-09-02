"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { looksBinary, parseDelimited } from "@/lib/csv";

/**
 * CSV se products charhana.
 *
 * DO QADAM, jaan boojh kar. Pehle PREVIEW -- kya banega, kya chhoRa
 * jayega, kahan ghalti hai -- aur us ke baad hi charhta hai. Ek qadam
 * mein charha dena us din mehnga paRta hai jis din header ki ek lakeer
 * khisak jati hai aur 200 products ghalat qeemat par bann jate hain.
 *
 * Aur ek usool jo yahan sab se ahem hai: JIS KA TRADE RATE NAHI DIYA,
 * us ka purchase_price sifar nahi likha jata -- us par
 * trade_rate_pending ka nishan lagta hai (241). Sifar ka matlab "muft
 * aaya tha" hai, aur us par munafa sau feesad ban jata hai.
 */

export interface ImportRow {
  line: number;
  name: string;
  packSize: string | null;
  unit: string | null;
  barcode: string | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  mrpPrice: number | null;
  wholesalePrice: number | null;
  manufactureDate: string | null;
  expiryDate: string | null;
  minStock: number | null;
  categoryName: string | null;
  brandName: string | null;
  companyName: string | null;

  // Preview ke faisle
  status: "new" | "duplicate" | "error";
  problem: string | null;
  notes: string[];
}

export interface ImportState {
  error?: string;
  notice?: string;
  success?: boolean;
  rows?: ImportRow[];
  summary?: { total: number; ready: number; duplicates: number; errors: number; noTradeRate: number; noWholesale: number };
  imported?: number;
}

const HR_ROLES = ["owner", "super_admin", "admin"];

/** Header ke naam: angrezi, Roman Urdu, aur aam ghaltiyan -- sab ek jagah. */
const HEADER_MAP: Record<string, keyof ImportRow> = {
  name: "name", naam: "name", product: "name", "product name": "name", item: "name",
  // Asal sheeton mein likhe hue naam -- ghaltiyon samet. Ye jaan boojh
  // kar shamil hain: dukan ki sheet haath se banti hai, aur "prodect"
  // likha hone par bande ko "naam ka khana nahi mila" kehna us se
  // apni hi sheet theek karwana hai, jo us ka kaam nahi.
  prodect: "name", prodcut: "name", produt: "name", "products name": "name",
  "product naam": "name", "item name": "name", cheez: "name",
  pack: "packSize", "pack size": "packSize", packsize: "packSize", size: "packSize",
  unit: "unit", ikai: "unit",
  barcode: "barcode", "bar code": "barcode",
  "trade rate": "purchasePrice", trade: "purchasePrice", "purchase price": "purchasePrice",
  "trade price": "purchasePrice", "trade pri": "purchasePrice", "trade rt": "purchasePrice",
  purchase: "purchasePrice", cost: "purchasePrice", lagat: "purchasePrice",
  "sale rate": "sellingPrice", sale: "sellingPrice", "selling price": "sellingPrice",
  selling: "sellingPrice", price: "sellingPrice", qeemat: "sellingPrice",
  mrp: "mrpPrice", "mrp price": "mrpPrice", "printed price": "mrpPrice",
  wholesale: "wholesalePrice", "wholesale rate": "wholesalePrice",
  "wholesale price": "wholesalePrice", thok: "wholesalePrice",
  "thok rate": "wholesalePrice", bulk: "wholesalePrice",
  retail: "sellingPrice", "retail rate": "sellingPrice", "retail price": "sellingPrice",
  mfg: "manufactureDate", "manufacture date": "manufactureDate",
  issue: "manufactureDate", "issue date": "manufactureDate",
  "manufacturing date": "manufactureDate", manufacture: "manufactureDate",
  expiry: "expiryDate", "expiry date": "expiryDate", exp: "expiryDate",
  expairy: "expiryDate", "expairy date": "expiryDate", experi: "expiryDate",
  "experi date": "expiryDate", expire: "expiryDate", "expire date": "expiryDate",
  "min stock": "minStock", "minimum stock": "minStock", minstock: "minStock",
  category: "categoryName", categories: "categoryName", qism: "categoryName",
  brand: "brandName", brands: "brandName",
  company: "companyName", companies: "companyName", "manufacturer": "companyName",
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

function toNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Tareekh.
 *
 * Pakistan mein log 05/09/2026 likhte hain aur us ka matlab 5 September
 * hota hai, 9 May nahi. Ye ek harf ka farq mahine bhar ki expiry ghalat
 * kar deta hai, is liye din pehle parha jata hai.
 */
function toDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // "Sep 2026" / "09-2026" -- mahine ka aakhri din maan lete hain, kyunke
  // expiry aksar sirf mahine tak likhi hoti hai.
  const my = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (my) {
    const month = Number(my[1]);
    const year = Number(my[2]);
    if (month < 1 || month > 12) return null;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${last}`;
  }

  return null;
}

async function canImport() {
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

  return { supabase, user, ok: !!me?.is_active && HR_ROLES.includes(me.role) };
}

// ---------------------------------------------------------------------
// Qadam 1: preview
// ---------------------------------------------------------------------
export async function previewProductsCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase, user, ok } = await canImport();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Products charhana sirf Owner ya Admin kar sakte hain." };

  const text = String(formData.get("csv") ?? "");
  if (!text.trim()) return { error: "CSV khali hai. File chunein ya matn yahan paste karein." };
  if (looksBinary(text)) return { error: "Ye Excel ki asal file lagti hai (.xlsx ya .xls), CSV nahi. Do mein se ek karein: Sheet mein File → Download → Comma Separated Values (.csv) kar ke wo file chunein, ya sheet mein khane chun kar copy karein aur neeche wale khane mein paste kar dein." };

  const table = parseDelimited(text);
  if (table.length < 2) {
    return { error: "CSV mein sirf ek lakeer hai. Pehli lakeer khanon ke naam ki honi chahiye, us ke neeche products." };
  }

  const header = table[0].map(norm);
  const cols: Partial<Record<keyof ImportRow, number>> = {};
  header.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (key && cols[key] === undefined) cols[key] = i;
  });

  if (cols.name === undefined) {
    return {
      error: `Naam ka khana nahi mila. Pehli lakeer mein "name" (ya "naam") likha hona chahiye. Mile hue khane: ${header.join(", ")}`,
    };
  }

  const at = (r: string[], k: keyof ImportRow) => {
    const i = cols[k];
    return i === undefined ? undefined : r[i]?.trim();
  };

  // Naam se pehchan -- ek dafa, har qatar par alag sawal nahi.
  const [{ data: categories }, { data: brands }, { data: companies }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("brands").select("id, name"),
    supabase.from("companies").select("id, name"),
    supabase.from("products").select("name, barcode").eq("is_deleted", false),
  ]);

  const byName = (list: { id: string; name: string }[] | null) =>
    new Map((list ?? []).map((x) => [norm(x.name), x.id]));
  const catMap = byName(categories);
  const brandMap = byName(brands);
  const compMap = byName(companies);

  const existingNames = new Set((existing ?? []).map((p) => norm(p.name)));
  const existingBarcodes = new Set(
    (existing ?? []).map((p) => (p.barcode ?? "").trim()).filter(Boolean)
  );

  // Isi file ke andar ki dohri qatarein bhi pakRi jati hain -- warna
  // ek hi product do dafa ban jata hai aur stock do jagah bat jata hai.
  const seenNames = new Set<string>();
  const seenBarcodes = new Set<string>();

  const rows: ImportRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const name = (at(r, "name") ?? "").trim();
    const notes: string[] = [];

    const barcode = (at(r, "barcode") ?? "").trim() || null;
    const purchasePrice = toNumber(at(r, "purchasePrice"));
    const sellingPrice = toNumber(at(r, "sellingPrice"));
    const mrpPrice = toNumber(at(r, "mrpPrice"));
    const wholesalePrice = toNumber(at(r, "wholesalePrice"));

    const row: ImportRow = {
      line: i + 1,
      name,
      packSize: (at(r, "packSize") ?? "").trim() || null,
      unit: (at(r, "unit") ?? "").trim() || null,
      barcode,
      purchasePrice,
      sellingPrice,
      mrpPrice,
      wholesalePrice,
      manufactureDate: toDate(at(r, "manufactureDate")),
      expiryDate: toDate(at(r, "expiryDate")),
      minStock: toNumber(at(r, "minStock")),
      categoryName: (at(r, "categoryName") ?? "").trim() || null,
      brandName: (at(r, "brandName") ?? "").trim() || null,
      companyName: (at(r, "companyName") ?? "").trim() || null,
      status: "new",
      problem: null,
      notes,
    };

    if (!name) {
      row.status = "error";
      row.problem = "Naam khali hai.";
      rows.push(row);
      continue;
    }

    if (sellingPrice === null) {
      row.status = "error";
      row.problem = "Sale rate nahi diya. Bina sale rate ke product bik nahi sakta.";
      rows.push(row);
      continue;
    }

    // Sale rate trade rate se kam ho to har bikri par nuqsan hota hai.
    // Ye rok nahi, khabardari hai -- kabhi jaan boojh kar bhi aisa hota
    // hai (khatam karne wala maal).
    if (purchasePrice !== null && sellingPrice < purchasePrice) {
      notes.push("Sale rate trade rate se KAM hai — har bikri par nuqsan hoga.");
    }

    if (purchasePrice === null) {
      notes.push("Trade rate nahi diya — nishan lagega, Rs 0 nahi likha jayega.");
    }

    // Thok ka rate lagat se kam bhi ho sakta hai (purana maal nikalna)
    // aur retail ke barabar bhi. Is liye ROK nahi -- sirf khabardari,
    // taake faisla soch kar ho.
    if (wholesalePrice !== null && purchasePrice !== null && wholesalePrice < purchasePrice) {
      notes.push("Thok ka rate trade rate se KAM hai — thok par nuqsan hoga.");
    }
    if (wholesalePrice !== null && wholesalePrice > sellingPrice) {
      notes.push("Thok ka rate retail se ZYADA hai — dekh lein, aksar ulta hota hai.");
    }

    if (row.expiryDate && row.manufactureDate && row.expiryDate < row.manufactureDate) {
      row.status = "error";
      row.problem = "Expiry manufacturing se pehle hai.";
      rows.push(row);
      continue;
    }

    const key = norm(name);
    if (barcode && (existingBarcodes.has(barcode) || seenBarcodes.has(barcode))) {
      row.status = "duplicate";
      row.problem = "Ye barcode pehle se maujood hai — ye qatar chhoR di jayegi.";
    } else if (existingNames.has(key) || seenNames.has(key)) {
      row.status = "duplicate";
      row.problem = "Is naam ka product pehle se hai — ye qatar chhoR di jayegi.";
    }

    if (row.status === "new") {
      seenNames.add(key);
      if (barcode) seenBarcodes.add(barcode);
    }

    // Qism/brand/company ka naam na mile to KHUD SE NAHI BANAYA JATA.
    // Ek harf ki ghalti se "Nestle" aur "Nestlé" do alag company ban
    // jate hain, aur phir har report do jagah se banti hai.
    if (row.categoryName && !catMap.has(norm(row.categoryName))) {
      notes.push(`Qism "${row.categoryName}" nahi mili — khali rahegi.`);
    }
    if (row.brandName && !brandMap.has(norm(row.brandName))) {
      notes.push(`Brand "${row.brandName}" nahi mila — khali rahega.`);
    }
    if (row.companyName && !compMap.has(norm(row.companyName))) {
      notes.push(`Company "${row.companyName}" nahi mili — khali rahegi.`);
    }

    rows.push(row);
  }

  const summary = {
    total: rows.length,
    ready: rows.filter((r) => r.status === "new").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    errors: rows.filter((r) => r.status === "error").length,
    noTradeRate: rows.filter((r) => r.status === "new" && r.purchasePrice === null).length,
    noWholesale: rows.filter((r) => r.status === "new" && r.wholesalePrice === null).length,
  };

  return {
    rows,
    summary,
    notice:
      summary.ready === 0
        ? "Ek bhi qatar charhne layak nahi. Neeche ki wajahein dekhein."
        : `${summary.ready} products charhne ke liye tayyar hain. Neeche dekh lein, phir charhayein.`,
  };
}

// ---------------------------------------------------------------------
// Qadam 2: charhana
// ---------------------------------------------------------------------
export async function importProductsCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase, user, ok } = await canImport();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Products charhana sirf Owner ya Admin kar sakte hain." };

  // Wohi CSV dobara parha jata hai, preview ka natija nahi bheja jata.
  // Wajah: browser se aaya hua natija badla ja sakta hai. Faisla usi
  // matn par dobara banta hai jo server ne khud parha.
  const preview = await previewProductsCsv({}, formData);
  if (preview.error) return preview;

  const rows = (preview.rows ?? []).filter((r) => r.status === "new");
  if (rows.length === 0) {
    return { error: "Charhne layak koi qatar nahi. Pehle wajahein theek karein." };
  }

  const [{ data: categories }, { data: brands }, { data: companies }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("brands").select("id, name"),
    supabase.from("companies").select("id, name"),
  ]);
  const byName = (list: { id: string; name: string }[] | null) =>
    new Map((list ?? []).map((x) => [norm(x.name), x.id]));
  const catMap = byName(categories);
  const brandMap = byName(brands);
  const compMap = byName(companies);

  const payload = rows.map((r) => ({
    name: r.name,
    pack_size: r.packSize,
    unit: r.unit,
    barcode: r.barcode,
    // Trade rate na ho to sifar jata hai (khana NOT NULL hai) MAGAR
    // us par nishan lagta hai. Nishan ke baghair ye sifar munafe mein
    // chup chaap juR jata.
    purchase_price: r.purchasePrice ?? 0,
    trade_rate_pending: r.purchasePrice === null,
    selling_price: r.sellingPrice ?? 0,
    mrp_price: r.mrpPrice,
    // Thok ka rate NULL rehta hai jab tak diya na jaye. Sifar likhne ka
    // matlab "thok par muft" hota.
    wholesale_price: r.wholesalePrice,
    manufacture_date: r.manufactureDate,
    expiry_date: r.expiryDate,
    min_stock_threshold: r.minStock,
    category_id: r.categoryName ? catMap.get(norm(r.categoryName)) ?? null : null,
    brand_id: r.brandName ? brandMap.get(norm(r.brandName)) ?? null : null,
    company_id: r.companyName ? compMap.get(norm(r.companyName)) ?? null : null,
    is_verified: true,
    created_by: user.id,
  }));

  const { data: inserted, error } = await supabase.from("products").insert(payload).select("id, branch_id");
  if (error) return { error: `Charhte waqt ruk gaya, kuch bhi nahi charha: ${error.message}` };

  // Har naye product ka inventory ka khana bhi banta hai -- wohi kaam
  // jo ek ek product banate waqt hota hai. Ye na ho to product POS par
  // to dikhta hai magar stock ka koi khana nahi hota.
  const branchIds = Array.from(new Set((inserted ?? []).map((p) => p.branch_id).filter(Boolean)));
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, branch_id")
    .eq("code", "MAIN")
    .in("branch_id", branchIds.length ? (branchIds as string[]) : ["00000000-0000-0000-0000-000000000000"]);

  const whByBranch = new Map((warehouses ?? []).map((w) => [w.branch_id, w.id]));
  const invRows = (inserted ?? [])
    .map((p) => {
      const wh = p.branch_id ? whByBranch.get(p.branch_id) : null;
      return wh ? { product_id: p.id, warehouse_id: wh, quantity_on_hand: 0 } : null;
    })
    .filter(Boolean) as { product_id: string; warehouse_id: string; quantity_on_hand: number }[];

  if (invRows.length > 0) {
    await supabase.from("inventory").insert(invRows);
  }

  const pending = payload.filter((p) => p.trade_rate_pending).length;

  await logAudit({
    actionType: "create",
    module: "products",
    recordId: "csv-import",
    recordLabel: "CSV se products",
    description: `${payload.length} products CSV se charhaye gaye${pending ? `, ${pending} ka trade rate baqi` : ""}`,
    changes: {
      charhe: { pehle: 0, ab: payload.length },
      trade_rate_baqi: { pehle: 0, ab: pending },
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/import");

  return {
    success: true,
    imported: payload.length,
    summary: preview.summary,
    notice: pending
      ? `${payload.length} products charh gaye. In mein ${pending} ka trade rate abhi baqi hai — un par nishan laga hua hai.`
      : `${payload.length} products charh gaye.`,
  };
}
