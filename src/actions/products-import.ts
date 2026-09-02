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
  /** Sheet ka "kitne aaye" -- stock tabhi charhta hai jab warehouse chuna gaya ho. */
  openingQty: number | null;
  categoryName: string | null;
  brandName: string | null;
  companyName: string | null;

  // Preview ke faisle
  status: "new" | "update" | "duplicate" | "error" | "skipped";
  /** Jab qatar kisi maujood product par charhni ho. */
  existingId?: string | null;
  problem: string | null;
  notes: string[];
}

export interface ImportState {
  error?: string;
  notice?: string;
  success?: boolean;
  rows?: ImportRow[];
  summary?: { total: number; ready: number; updates: number; duplicates: number; errors: number; skipped: number; noTradeRate: number; noWholesale: number };
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
  // "Kitne aaye" -- ye product ka khana nahi, stock ka hai. Isi liye
  // wo tabhi charhta hai jab banda warehouse chunta hai (253).
  qty: "openingQty", quantity: "openingQty", quantiti: "openingQty",
  quantati: "openingQty", quentety: "openingQty", tadad: "openingQty",
  "opening qty": "openingQty", stock: "openingQty",
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
// Bande ki apni durustiyan
// ---------------------------------------------------------------------
/**
 * Preview par likhi hui durusti, aur chhoRi hui qatarein.
 *
 * YE KYA HAIN, AUR KYA NAHI: yahan se sirf wo LIKHAI aati hai jo bande
 * ne khud theek ki -- naam, pack, rate, tareekh. Faisle (kya banega,
 * kya pehle se hai, kahan ghalti hai, dohri qatar kaun si) yahan se
 * NAHI aate; wo ab bhi server khud CSV par se banata hai.
 *
 * Is liye wo purana usool qaim hai: browser ka bheja hua NATIJA nahi
 * maana jata. Natija nahi aata -- sirf likhai aati hai, aur us par wohi
 * poori jaanch dobara chalti hai jo baqi qataron par chalti hai.
 *
 * Faida ye ke jo preview mein nazar aata hai, bilkul wohi charhta hai:
 * dono jagah ek hi hisaab, do nahi.
 */
type RowEdit = Partial<Record<"name" | "packSize" | "purchasePrice" | "sellingPrice" | "wholesalePrice" | "expiryDate" | "manufactureDate" | "barcode", string>>;

const EDITABLE = new Set([
  "name", "packSize", "purchasePrice", "sellingPrice", "wholesalePrice", "expiryDate", "manufactureDate", "barcode",
]);

function parseEdits(raw: FormDataEntryValue | null): Map<number, RowEdit> {
  const out = new Map<number, RowEdit>();
  if (typeof raw !== "string" || !raw.trim()) return out;
  try {
    const obj = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    for (const [line, fields] of Object.entries(obj ?? {})) {
      const n = Number(line);
      if (!Number.isInteger(n)) continue;
      const edit: RowEdit = {};
      for (const [k, v] of Object.entries(fields ?? {})) {
        // Sirf wohi khane jin ki ijazat hai. Bahar se koi aur naam
        // bhej de to wo chup chaap chhoR diya jata hai.
        if (EDITABLE.has(k) && typeof v === "string") (edit as Record<string, string>)[k] = v.slice(0, 300);
      }
      if (Object.keys(edit).length > 0) out.set(n, edit);
    }
  } catch {
    // Kharab JSON par durusti chhoR di jati hai, poora kaam nahi.
  }
  return out;
}

function parseSkips(raw: FormDataEntryValue | null): Set<number> {
  const out = new Set<number>();
  if (typeof raw !== "string" || !raw.trim()) return out;
  try {
    const arr = JSON.parse(raw) as unknown[];
    for (const v of Array.isArray(arr) ? arr : []) {
      const n = Number(v);
      if (Number.isInteger(n)) out.add(n);
    }
  } catch {
    // wohi soch
  }
  return out;
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

  const edits = parseEdits(formData.get("edits"));
  const skips = parseSkips(formData.get("skip"));

  // Naam se pehchan -- ek dafa, har qatar par alag sawal nahi.
  const [{ data: categories }, { data: brands }, { data: companies }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("brands").select("id, name"),
    supabase.from("companies").select("id, name"),
    supabase
      .from("products")
      .select("id, name, barcode, selling_price, purchase_price, trade_rate_pending, sale_rate_pending")
      .eq("is_deleted", false),
  ]);

  const byName = (list: { id: string; name: string }[] | null) =>
    new Map((list ?? []).map((x) => [norm(x.name), x.id]));
  const catMap = byName(categories);
  const brandMap = byName(brands);
  const compMap = byName(companies);

  // Maujood products -- naam aur barcode, dono se pehchan.
  //
  // Naam ek se zyada products par ho sakta hai (do "supreme"). Aise
  // naam par milaan NAHI hota: kaun sa "supreme" murad hai, ye faisla
  // sheet nahi kar sakti, aur ghalat product ka rate badalna khamoshi
  // se ghalat lagat bana deta hai.
  type Existing = {
    id: string;
    selling_price: number;
    purchase_price: number;
    trade_rate_pending: boolean;
    sale_rate_pending: boolean;
  };
  const byNameMap = new Map<string, Existing | null>();
  const byBarcodeMap = new Map<string, Existing>();
  for (const p of existing ?? []) {
    const rec: Existing = {
      id: p.id,
      selling_price: Number(p.selling_price ?? 0),
      purchase_price: Number(p.purchase_price ?? 0),
      trade_rate_pending: Boolean(p.trade_rate_pending),
      sale_rate_pending: Boolean(p.sale_rate_pending),
    };
    const k = norm(p.name);
    byNameMap.set(k, byNameMap.has(k) ? null : rec);
    const bc = (p.barcode ?? "").trim();
    if (bc) byBarcodeMap.set(bc, rec);
  }

  const existingNames = new Set(byNameMap.keys());
  const existingBarcodes = new Set(byBarcodeMap.keys());

  // Isi file ke andar ki dohri qatarein bhi pakRi jati hain -- warna
  // ek hi product do dafa ban jata hai aur stock do jagah bat jata hai.
  const seenNames = new Set<string>();
  const seenBarcodes = new Set<string>();

  const rows: ImportRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const lineNo = i + 1;

    // Bande ki likhi hui durusti CSV ki likhai par bhaari hai -- magar
    // jaanch dono par ek jaisi chalti hai.
    const edit = edits.get(lineNo);
    const pick = (k: keyof ImportRow & keyof RowEdit) => {
      const v = edit?.[k];
      return v !== undefined ? v.trim() : at(r, k);
    };

    const name = (pick("name") ?? "").trim();
    const notes: string[] = [];

    const barcode = (pick("barcode") ?? "").trim() || null;
    const purchasePrice = toNumber(pick("purchasePrice"));
    const sellingPrice = toNumber(pick("sellingPrice"));
    const mrpPrice = toNumber(at(r, "mrpPrice"));
    const wholesalePrice = toNumber(pick("wholesalePrice"));

    const row: ImportRow = {
      line: lineNo,
      name,
      packSize: (pick("packSize") ?? "").trim() || null,
      unit: (at(r, "unit") ?? "").trim() || null,
      barcode,
      purchasePrice,
      sellingPrice,
      mrpPrice,
      wholesalePrice,
      manufactureDate: toDate(pick("manufactureDate")),
      expiryDate: toDate(pick("expiryDate")),
      minStock: toNumber(at(r, "minStock")),
      openingQty: toNumber(at(r, "openingQty")),
      existingId: null,
      categoryName: (at(r, "categoryName") ?? "").trim() || null,
      brandName: (at(r, "brandName") ?? "").trim() || null,
      companyName: (at(r, "companyName") ?? "").trim() || null,
      status: "new",
      problem: null,
      notes,
    };

    // Jo qatar bande ne khud chhoR di, us par koi jaanch nahi chalti
    // aur wo dohri qatar ki ginti mein bhi nahi aati -- warna ek
    // chhoRi hui qatar us jaise doosre naam ko rok deti.
    if (skips.has(lineNo)) {
      row.status = "skipped";
      row.problem = "Aap ne ye qatar chhoR di hai.";
      rows.push(row);
      continue;
    }

    if (!name) {
      row.status = "error";
      row.problem = "Naam khali hai.";
      rows.push(row);
      continue;
    }

    // Sale rate na ho to qatar ROKI nahi jati -- naam, expiry aur
    // trade rate to maujood hain, aur teen qataron ki wajah se sattaees
    // ka kaam rok dena ghalat hai. Product ban jata hai, us par nishan
    // lagta hai, aur wo "Rate Baqi" ki fehrist mein aa jata hai.
    //
    // Magar wo BIK nahi sakta: selling_price mein 0 jata hai (khana NOT
    // NULL hai) aur 0 ko qeemat samajh liya jaye to cheez muft chali
    // jaye. Rok POS par bhi hai aur database par bhi (252).
    if (sellingPrice === null) {
      notes.push("Sale rate nahi diya — product ban jayega magar bikega nahi, jab tak rate na bhara jaye.");
    }

    // Sale rate trade rate se kam ho to har bikri par nuqsan hota hai.
    // Ye rok nahi, khabardari hai -- kabhi jaan boojh kar bhi aisa hota
    // hai (khatam karne wala maal).
    if (purchasePrice !== null && sellingPrice !== null && sellingPrice < purchasePrice) {
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
    if (wholesalePrice !== null && sellingPrice !== null && wholesalePrice > sellingPrice) {
      notes.push("Thok ka rate retail se ZYADA hai — dekh lein, aksar ulta hota hai.");
    }

    if (row.expiryDate && row.manufactureDate && row.expiryDate < row.manufactureDate) {
      row.status = "error";
      row.problem = "Expiry manufacturing se pehle hai.";
      rows.push(row);
      continue;
    }

    const key = norm(name);
    // Isi file ke andar ki dohri qatar ab bhi chhoRi jati hai -- ek hi
    // sheet mein ek cheez do dafa ho to doosri wali pehli par charh kar
    // us ka rate badal deti, aur aakhri jeet jata. Wo ghalti khamoshi
    // se hoti hai.
    if (barcode && seenBarcodes.has(barcode)) {
      row.status = "duplicate";
      row.problem = "Isi sheet mein ye barcode do dafa hai — ye qatar chhoR di jayegi.";
    } else if (seenNames.has(key)) {
      row.status = "duplicate";
      row.problem = "Isi sheet mein ye naam do dafa hai — har ek ko apna naam dein.";
    } else {
      // Maujood product mila to qatar CHHOTI nahi jati -- us par charh
      // jati hai. Sheet har mahine naye rate ke sath aati hai, aur har
      // dafa "pehle se hai" keh dena us sheet ko bekaar kar deta hai.
      const hit = (barcode ? byBarcodeMap.get(barcode) : undefined) ?? byNameMap.get(key) ?? undefined;

      if (hit === undefined && byNameMap.has(key)) {
        // Naam to mila, magar us naam par ek se zyada product hain.
        row.status = "duplicate";
        row.problem =
          "Is naam ke ek se zyada products pehle se hain — kaun sa murad hai ye sheet se tay nahi hota. Naam mein farq laga dein.";
      } else if (hit) {
        row.status = "update";
        row.existingId = hit.id;

        // Purana rate saamne likha jata hai, taake tabdeeli dekh kar
        // manzoor ho -- chup chaap nahi.
        if (purchasePrice !== null) {
          notes.push(
            hit.trade_rate_pending
              ? `Trade rate charhega: pehle maloom nahi tha → ${purchasePrice}`
              : hit.purchase_price === purchasePrice
                ? "Trade rate wohi hai — koi tabdeeli nahi."
                : `Trade rate badlega: ${hit.purchase_price} → ${purchasePrice}`
          );
        }
        if (sellingPrice !== null) {
          notes.push(
            hit.sale_rate_pending
              ? `Sale rate charhega: pehle maloom nahi tha → ${sellingPrice}`
              : hit.selling_price === sellingPrice
                ? "Sale rate wohi hai — koi tabdeeli nahi."
                : `Sale rate badlega: ${hit.selling_price} → ${sellingPrice}`
          );
        }
        if (purchasePrice === null && sellingPrice === null && wholesalePrice === null) {
          row.status = "duplicate";
          row.problem = "Ye product pehle se hai aur is qatar mein koi naya rate nahi — kuch nahi badlega.";
        }
      }
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
    updates: rows.filter((r) => r.status === "update").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
    errors: rows.filter((r) => r.status === "error").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
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
  const updateRows = (preview.rows ?? []).filter((r) => r.status === "update" && r.existingId);
  if (rows.length === 0 && updateRows.length === 0) {
    return { error: "Charhne layak koi qatar nahi. Pehle wajahein theek karein." };
  }

  // "Kitne aaye" tabhi charhta hai jab banda warehouse chunta hai.
  //
  // Ye rok jaan boojh kar hai. Stock ka ek hi malik hai (129), aur us
  // ke har adad ke sath ye sawal juRa hai ke maal PARA KAHAN hai. Sheet
  // us sawal ka jawab nahi deti. Bina jagah ke adad barha dena stock ko
  // hawa mein khaRa kar deta hai -- aur us ka pata ginti ke din chalta
  // hai.
  const warehouseId = String(formData.get("warehouse_id") ?? "").trim() || null;

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
    // Sale rate na ho to bhi sifar jata hai (khana NOT NULL hai) magar
    // nishan ke sath -- aur nishan par taala hai: bikega nahi (252).
    selling_price: r.sellingPrice ?? 0,
    sale_rate_pending: r.sellingPrice === null,
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

  let inserted: { id: string; branch_id: string | null; name: string }[] = [];
  if (payload.length > 0) {
    const { data, error } = await supabase.from("products").insert(payload).select("id, branch_id, name");
    if (error) return { error: `Charhte waqt ruk gaya, kuch bhi nahi charha: ${error.message}` };
    inserted = (data ?? []) as typeof inserted;
  }

  // Har naye product ka inventory ka khana bhi banta hai -- wohi kaam
  // jo ek ek product banate waqt hota hai. Ye na ho to product POS par
  // to dikhta hai magar stock ka koi khana nahi hota.
  const branchIds = Array.from(new Set(inserted.map((p) => p.branch_id).filter(Boolean)));
  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, branch_id")
    .eq("code", "MAIN")
    .in("branch_id", branchIds.length ? (branchIds as string[]) : ["00000000-0000-0000-0000-000000000000"]);

  const whByBranch = new Map((warehouses ?? []).map((w) => [w.branch_id, w.id]));
  const invRows = inserted
    .map((p) => {
      const wh = p.branch_id ? whByBranch.get(p.branch_id) : null;
      return wh ? { product_id: p.id, warehouse_id: wh, quantity_on_hand: 0 } : null;
    })
    .filter(Boolean) as { product_id: string; warehouse_id: string; quantity_on_hand: number }[];

  if (invRows.length > 0) {
    await supabase.from("inventory").insert(invRows);
  }

  // -------------------------------------------------------------------
  // Purane products par naya rate
  // -------------------------------------------------------------------
  // Rate seedha yahan se nahi likha jata. fn_set_product_rates (253)
  // teen kaam ek sath karta hai: rate likhna, "abhi maloom nahi" ka
  // nishan hatana, aur indraj karna. Alag alag likhne se wo soorat
  // banti hai jahan rate charh gaya aur indraj reh gaya -- aur us ka
  // pata us din chalta hai jis din koi poochhta hai "ye cheez pehle
  // 240 ki thi, ab 310 ki kyun hai?"
  let updated = 0;
  const updateProblems: string[] = [];

  for (const r of updateRows) {
    const { error: rateErr } = await supabase.rpc("fn_set_product_rates", {
      p_product_id: r.existingId as string,
      p_sale: r.sellingPrice,
      p_trade: r.purchasePrice,
      p_wholesale: r.wholesalePrice,
      p_source: "import",
    });
    if (rateErr) {
      updateProblems.push(`${r.name}: ${rateErr.message}`);
      continue;
    }
    updated += 1;
  }

  // -------------------------------------------------------------------
  // "Kitne aaye" -- sirf tab, jab jagah maloom ho
  // -------------------------------------------------------------------
  let stocked = 0;
  let qtyIgnored = 0;

  const withQty = [...rows, ...updateRows].filter((r) => (r.openingQty ?? 0) > 0);

  if (withQty.length > 0 && !warehouseId) {
    qtyIgnored = withQty.length;
  } else if (withQty.length > 0 && warehouseId) {
    const idByName = new Map(inserted.map((p) => [norm(p.name), p.id]));

    for (const r of withQty) {
      const pid = r.existingId ?? idByName.get(norm(r.name));
      if (!pid) continue;

      // batch_id khali wali qatar hi barhti hai. Jis maal ka apna batch
      // hai us ka hisaab alag rehta hai -- us mein sheet se adad jorhna
      // do alag cheezon ko mila dena hai.
      const { data: existingInv } = await supabase
        .from("inventory")
        .select("id, quantity_on_hand")
        .eq("product_id", pid)
        .eq("warehouse_id", warehouseId)
        .is("batch_id", null)
        .maybeSingle();

      const add = Number(r.openingQty ?? 0);

      if (existingInv) {
        // Barhta hai, badalta nahi. Sheet kehti hai "itna aaya", ye
        // nahi ke "ab kul itna hai".
        const { error: upErr } = await supabase
          .from("inventory")
          .update({ quantity_on_hand: Number(existingInv.quantity_on_hand ?? 0) + add })
          .eq("id", existingInv.id);
        if (!upErr) stocked += 1;
      } else {
        const { error: insErr } = await supabase
          .from("inventory")
          .insert({ product_id: pid, warehouse_id: warehouseId, quantity_on_hand: add });
        if (!insErr) stocked += 1;
      }
    }
  }

  const pending = payload.filter((p) => p.trade_rate_pending).length;

  await logAudit({
    actionType: "create",
    module: "products",
    recordId: "csv-import",
    recordLabel: "CSV se products",
    description:
      `${payload.length} products bane, ${updated} purane products ka rate badla` +
      (stocked ? `, ${stocked} par stock charha` : "") +
      (pending ? `, ${pending} ka trade rate baqi` : ""),
    changes: {
      bane: { pehle: 0, ab: payload.length },
      rate_badla: { pehle: 0, ab: updated },
      stock_charha: { pehle: 0, ab: stocked },
      trade_rate_baqi: { pehle: 0, ab: pending },
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/import");
  revalidatePath("/admin/products/rates-baqi");
  revalidatePath("/admin/pos");

  const parts: string[] = [];
  if (payload.length) parts.push(`${payload.length} naye products bane.`);
  if (updated) parts.push(`${updated} purane products ka rate badal gaya.`);
  if (stocked) parts.push(`${stocked} par stock charh gaya.`);
  if (qtyIgnored) {
    parts.push(
      `${qtyIgnored} qataron mein "kitne aaye" likha tha magar warehouse nahi chuna gaya — wo adad nahi charhe.`
    );
  }
  if (pending) parts.push(`${pending} ka trade rate abhi baqi hai — un par nishan laga hua hai.`);
  if (updateProblems.length) parts.push(`Kuch rate nahi charhe: ${updateProblems.slice(0, 3).join(" | ")}`);

  return {
    success: true,
    imported: payload.length + updated,
    summary: preview.summary,
    notice: parts.join(" "),
  };
}
