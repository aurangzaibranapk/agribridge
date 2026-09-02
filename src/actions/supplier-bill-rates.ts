"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { readSupplierBillLines } from "@/lib/ai/bill-lines-client";
import { createClient } from "@/lib/supabase/server";
import { parseDelimited } from "@/lib/csv";

/**
 * Supplier ke bill se trade rate charhane ka kaam.
 *
 * Do qadam, jaan boojh kar alag:
 *   1) Bill ki photo charhti hai, AI qatarein parhta hai, wo mehfooz
 *      ho jati hain.
 *   2) Banda har qatar ke saamne product chunta hai, phir rate charhta
 *      hai.
 *
 * Beech ka qadam mitaya nahi ja sakta. Bill par "SUFI 5LTR" likha hota
 * hai aur hamare paas "Sufi Cooking Oil 5 Litre" -- ye faisla ke dono
 * ek hi cheez hain, bande ka hai. Ek ghalat milaan chup chaap ghalat
 * lagat bana deta hai, aur us ka pata mahine baad munafe ke adad se
 * chalta hai.
 */

export interface BillRateState {
  error?: string;
  notice?: string;
  success?: boolean;
  billId?: string;
  applied?: number;
  failed?: number;
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

const paths = (billId?: string) => {
  revalidatePath("/admin/products/bill-rates");
  if (billId) revalidatePath(`/admin/products/bill-rates/${billId}`);
  revalidatePath("/admin/products");
};

/**
 * Naam ko milaan ke qabil banana.
 *
 * Bill par "SUFI-5LTR", catalogue mein "Sufi 5 Ltr". Nishan aur khali
 * jagah hata dene se ye dono ek jaise ho jate hain. Is se zyada
 * hoshiyari yahan jaan boojh kar nahi ki gayi: jo aap se aap milta
 * hai, us par bhi banda nazar daalta hai.
 */
function matchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

// =====================================================================
// 1) Bill charhana aur parhwana
// =====================================================================
/**
 * Ek bill, kai file.
 *
 * Bill do ya teen safhon ka hota hai, aur aksar PDF mein aata hai. Har
 * safhe ko alag "bill" bana dena ghalat hisaab deta hai: bill ka kul
 * ek hi hota hai, aur qataron ka jorh us se milana chahiye. Is liye
 * saari file ek hi bill ke neeche baithti hain.
 *
 * Har file ka apna indraj banta hai. Jo file parhi na ja sake, us par
 * wajah likhi jati hai -- khamoshi se chhoR dene par banda samajhta
 * hai ke poora bill parh liya gaya.
 */
async function matchMap(supabase: ReturnType<typeof createClient>) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size")
    .eq("is_deleted", false)
    .limit(5000);

  const byName = new Map<string, string>();
  for (const p of products ?? []) {
    const k = matchKey(p.name);
    // Do products ka naam ek jaisa ho to milaan chhoR diya jata hai --
    // aadha sahi milaan bilkul galat milaan jitna hi khatarnak hai.
    if (byName.has(k)) byName.set(k, "");
    else byName.set(k, p.id);

    if (p.pack_size) {
      const k2 = matchKey(`${p.name}${p.pack_size}`);
      if (byName.has(k2)) byName.set(k2, "");
      else byName.set(k2, p.id);
    }
  }
  return byName;
}

/**
 * Naam se apne aap milaan -- sirf poora naam milne par.
 *
 * `taken` wo products hain jo isi bill mein pehle se kisi qatar par lag
 * chuke hain. Ek hi bill mein ek product do dafa charhne se rate do
 * dafa badalta hai aur aakhri jeet jata hai -- bina kisi ke jaane. Is
 * liye doosri dafa milaan nahi hota, qatar khali chhoR di jati hai aur
 * banda khud dekhta hai.
 */
function autoMatch(
  byName: Map<string, string>,
  taken: Set<string>,
  itemName: string | null,
  packSize: string | null
): string | null {
  if (!itemName) return null;
  const direct = byName.get(matchKey(itemName));
  const withPack = packSize ? byName.get(matchKey(`${itemName}${packSize}`)) : undefined;
  const id = (withPack || direct) ?? null;
  if (!id || id === "" || taken.has(id)) return null;
  taken.add(id);
  return id;
}

export async function createBillFromFiles(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Bill se rate charhana sirf Owner, Admin ya Warehouse wale ka kaam hai." };

  let files: { url: string; mime: string }[] = [];
  try {
    const raw = JSON.parse(String(formData.get("files") ?? "[]"));
    if (Array.isArray(raw)) {
      files = raw
        .filter((f) => f && typeof f.url === "string" && f.url)
        .slice(0, 20)
        .map((f) => ({ url: String(f.url), mime: String(f.mime ?? "") }));
    }
  } catch {
    return { error: "File ki fehrist samajh nahi aayi. Dobara lagayein." };
  }

  if (files.length === 0) return { error: "Bill ki tasveer ya PDF lagayein." };

  const supplierId = (formData.get("supplier_id") as string) || null;

  const kinds = new Set(files.map((f) => (f.mime === "application/pdf" ? "pdf" : "photo")));
  const source = kinds.size > 1 ? "mixed" : [...kinds][0];

  const { data: bill, error } = await supabase
    .from("supplier_bill_reads")
    .insert({
      // Pehli file bhi rakhi jati hai -- fehrist par ek nazar mein
      // dikhane ke liye. Asal fehrist supplier_bill_files hai.
      image_url: files[0].url,
      source,
      supplier_id: supplierId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("supplier_bill_files").insert(
    files.map((f, i) => ({
      bill_read_id: bill.id,
      file_url: f.url,
      mime_type: f.mime || null,
      page_no: i + 1,
    }))
  );

  const byName = await matchMap(supabase);
  const taken = new Set<string>();

  let lineNo = 0;
  let readAny = false;
  let binaRate = 0;
  const failedPages: number[] = [];
  const head: { supplierName: string | null; billNumber: string | null; billDate: string | null; billTotal: number | null } = {
    supplierName: null,
    billNumber: null,
    billDate: null,
    billTotal: null,
  };

  for (let i = 0; i < files.length; i++) {
    const reading = await readSupplierBillLines(files[i].url);
    const pageNo = i + 1;

    if (!reading) {
      failedPages.push(pageNo);
      await supabase
        .from("supplier_bill_files")
        .update({
          problem:
            "Ye file parhi nahi ja saki (ho sakta hai GEMINI_API_KEY na laga ho, ya file saaf na ho). Qatarein khud likh lein.",
        })
        .eq("bill_read_id", bill.id)
        .eq("page_no", pageNo);
      continue;
    }

    readAny = true;

    // Bill ka sar (naam, number, tareekh, kul) pehle safhe se leta
    // hai; baad wale safhe sirf tab bharte hain jab pehla khali ho.
    head.supplierName ??= reading.supplierName;
    head.billNumber ??= reading.billNumber;
    head.billDate ??= reading.billDate;
    head.billTotal ??= reading.billTotal;

    const rows = reading.lines.map((line) => {
      lineNo += 1;
      const productId = autoMatch(byName, taken, line.itemName, line.packSize);
      if (line.rate == null) binaRate += 1;
      return {
        bill_read_id: bill.id,
        line_no: lineNo,
        page_no: pageNo,
        raw_text: line.rawText || null,
        item_name: line.itemName,
        pack_size: line.packSize,
        qty: line.qty,
        rate: line.rate,
        line_total: line.lineTotal,
        product_id: productId,
        match_source: productId ? "auto_name" : null,
        status: "draft",
      };
    });

    if (rows.length > 0) await supabase.from("supplier_bill_lines").insert(rows);

    await supabase
      .from("supplier_bill_files")
      .update({ ai_read_at: new Date().toISOString(), lines_found: rows.length, problem: null })
      .eq("bill_read_id", bill.id)
      .eq("page_no", pageNo);
  }

  if (readAny) {
    await supabase
      .from("supplier_bill_reads")
      .update({
        supplier_name_raw: head.supplierName,
        bill_number: head.billNumber,
        bill_date: head.billDate,
        bill_total: head.billTotal,
        ai_read_at: new Date().toISOString(),
      })
      .eq("id", bill.id);
  }

  await logAudit({
    actionType: "create",
    module: "products",
    recordId: bill.id,
    recordLabel: head.billNumber ?? "Supplier bill",
    description: `Supplier ka bill parha gaya — ${files.length} file, ${lineNo} qatarein`,
  });

  paths(bill.id);

  const parts = [`${files.length} file mein se ${lineNo} qatarein parhi gayin.`];
  if (binaRate > 0) parts.push(`In mein se ${binaRate} ka rate bill par saaf nahi tha — wo khali hain.`);
  if (failedPages.length > 0) parts.push(`File ${failedPages.join(", ")} parhi nahi ja saki.`);

  return { success: true, billId: bill.id, notice: parts.join(" ") };
}

// =====================================================================
// 1b) Sheet se rate
// =====================================================================
/**
 * Kabhi bill hota hi nahi -- supplier rate ki ek sheet bhejta hai.
 *
 * Ye raasta AI se guzarta hi nahi: sheet mein rate LIKHA hua adad hai,
 * parha hua nahi. Jahan adad saaf likha ho, wahan AI se parhwana sirf
 * ek nayi ghalti ka darwaza kholta hai.
 *
 * Magar aage ka qanoon wohi rehta hai: product AAP chunte hain, aur
 * rate manzoori ke baad charhta hai. Sheet mein "SUFI 5LTR" likha hone
 * se ye tay nahi hota ke hamare catalogue mein kaun sa product hai.
 */
export async function createBillFromSheet(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Bill se rate charhana sirf Owner, Admin ya Warehouse wale ka kaam hai." };

  const text = String(formData.get("sheet") ?? "");
  if (text.trim().length === 0) return { error: "Sheet khali hai. Excel se khane copy kar ke yahan paste karein." };

  const table = parseDelimited(text);
  if (table.length < 2) {
    return { error: "Sheet mein sirf ek lakeer hai. Pehli lakeer khanon ke naam ki honi chahiye, us ke neeche qatarein." };
  }

  const norm = (v: string) => v.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const header = table[0].map(norm);

  const NAME = ["name", "naam", "product", "product name", "item", "cheez"];
  const RATE = ["trade rate", "trade", "rate", "purchase price", "purchase", "cost", "lagat"];
  const PACK = ["pack", "pack size", "packsize", "size"];
  const QTY = ["qty", "quantity", "quantati", "tadad", "kitne"];

  const findCol = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iName = findCol(NAME);
  const iRate = findCol(RATE);
  const iPack = findCol(PACK);
  const iQty = findCol(QTY);

  if (iName < 0) {
    return {
      error: `Naam ka khana nahi mila. Pehli lakeer mein "name" (ya "naam") likha hona chahiye. Mile hue khane: ${table[0].join(", ")}`,
    };
  }
  if (iRate < 0) {
    return {
      error: `Rate ka khana nahi mila. Pehli lakeer mein "trade rate" (ya "rate") likha hona chahiye. Mile hue khane: ${table[0].join(", ")}`,
    };
  }

  const num = (v: string | undefined): number | null => {
    if (v == null) return null;
    const cleaned = v.replace(/[^0-9.]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const { data: bill, error } = await supabase
    .from("supplier_bill_reads")
    .insert({
      source: "sheet",
      supplier_id: (formData.get("supplier_id") as string) || null,
      bill_number: String(formData.get("bill_number") ?? "").trim() || null,
      bill_date: String(formData.get("bill_date") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const byName = await matchMap(supabase);
  const taken = new Set<string>();

  let lineNo = 0;
  let binaRate = 0;

  const rows = table.slice(1).map((r) => {
    lineNo += 1;
    const itemName = (r[iName] ?? "").trim() || null;
    const packSize = iPack >= 0 ? (r[iPack] ?? "").trim() || null : null;
    // Rate khali ho to khali hi rehta hai. Sifar likhne ka matlab
    // "muft aaya" hota, aur wo adad seedha munafe mein chala jata.
    const rate = num(r[iRate]);
    if (rate == null) binaRate += 1;
    const productId = autoMatch(byName, taken, itemName, packSize);

    return {
      bill_read_id: bill.id,
      line_no: lineNo,
      raw_text: r.join(" | ").slice(0, 400) || null,
      item_name: itemName,
      pack_size: packSize,
      qty: iQty >= 0 ? num(r[iQty]) : null,
      rate,
      line_total: null,
      product_id: productId,
      match_source: productId ? "auto_name" : null,
      status: "draft",
    };
  });

  const usable = rows.filter((r) => r.item_name);
  if (usable.length === 0) {
    await supabase.from("supplier_bill_reads").delete().eq("id", bill.id);
    return { error: "Ek bhi qatar mein naam nahi mila. Khanon ke naam dekh lein." };
  }

  const { error: lineErr } = await supabase.from("supplier_bill_lines").insert(usable);
  if (lineErr) {
    paths(bill.id);
    return { success: true, billId: bill.id, notice: `Sheet charh gayi magar qatarein mehfooz nahi hui: ${lineErr.message}` };
  }

  await logAudit({
    actionType: "create",
    module: "products",
    recordId: bill.id,
    recordLabel: "Sheet se rate",
    description: `Sheet se ${usable.length} qatarein aayin`,
  });

  paths(bill.id);

  return {
    success: true,
    billId: bill.id,
    notice:
      `${usable.length} qatarein aa gayin.` +
      (binaRate > 0 ? ` In mein se ${binaRate} ka rate khali tha — wo waise hi khali hain.` : ""),
  };
}

// =====================================================================
// 2) Ek qatar theek karna
// =====================================================================
export async function saveBillLine(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const lineId = String(formData.get("line_id") ?? "");
  if (!lineId) return { error: "Qatar saaf nahi." };

  const { data: line } = await supabase
    .from("supplier_bill_lines")
    .select("id, bill_read_id, status, product_id, match_source")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { error: "Qatar nahi mili." };
  if (line.status === "applied") return { error: "Is qatar ka rate charh chuka hai — ab ye nahi badalti." };

  const num = (key: string): number | null => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const chosen = String(formData.get("product_id") ?? "").trim();
  const productId = chosen || null;
  const rate = num("rate");
  const qty = num("qty");

  // "Ready" ka matlab: ye qatar charhne layak hai. Bina product ya
  // bina rate ke wo dawa jhooti hai -- database bhi yahi kehta hai.
  const ready = Boolean(productId) && rate != null;

  const { error } = await supabase
    .from("supplier_bill_lines")
    .update({
      item_name: String(formData.get("item_name") ?? "").trim() || null,
      qty,
      rate,
      product_id: productId,
      match_source: productId ? (productId === line.product_id ? line.match_source ?? "chosen" : "chosen") : null,
      status: ready ? "ready" : "draft",
      problem: null,
    })
    .eq("id", lineId);

  if (error) {
    // Ek hi bill mein ek product do qataron par lag jaye to rate do
    // dafa badalta hai aur aakhri jeet jata hai -- bina kisi ke jaane.
    // Database wahin rok deta hai; yahan us rok ko bande ki zaban mein
    // likha jata hai, warna wo Postgres ka paighaam parh kar samajhta
    // hai ke nizam kharab hai.
    if (error.code === "23505") {
      return {
        error:
          "Ye product isi bill ki kisi aur qatar par pehle se laga hua hai. Ek bill mein ek product ka ek hi rate charhta hai — pehle wali qatar dekh lein.",
      };
    }
    return { error: error.message };
  }

  paths(line.bill_read_id);
  return { success: true, notice: ready ? "Qatar tayyar hai." : "Mehfooz ho gaya." };
}

export async function skipBillLine(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const lineId = String(formData.get("line_id") ?? "");
  const { data: line } = await supabase
    .from("supplier_bill_lines")
    .select("bill_read_id, status")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { error: "Qatar nahi mili." };
  if (line.status === "applied") return { error: "Jo rate charh chuka hai wo chhoRa nahi ja sakta." };

  const { error } = await supabase
    .from("supplier_bill_lines")
    .update({ status: "skipped" })
    .eq("id", lineId);
  if (error) return { error: error.message };

  paths(line.bill_read_id);
  return { success: true, notice: "Ye qatar chhoR di gayi." };
}

// =====================================================================
// 3) Rate charhana
// =====================================================================
/**
 * Har qatar apne darwaze se charhti hai (fn_apply_bill_line_rate), aur
 * har ek apni jagah mukammal hoti hai: rate, "abhi maloom nahi" ka
 * nishan, aur indraj -- teenon ya koi nahi.
 *
 * Ek qatar ka na charhna baqi ko nahi rokta -- magar wo chup chaap bhi
 * nahi jati, us par wajah likh di jati hai.
 */
export async function applyBillRates(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Rate charhana sirf Owner, Admin ya Warehouse wale ka kaam hai." };

  const billId = String(formData.get("bill_id") ?? "");
  if (!billId) return { error: "Bill saaf nahi." };

  const { data: bill } = await supabase
    .from("supplier_bill_reads")
    .select("id, status, bill_number")
    .eq("id", billId)
    .maybeSingle();
  if (!bill) return { error: "Bill nahi mila." };
  if (bill.status === "applied") return { error: "Is bill ke rate pehle hi charh chuke hain." };

  const { data: lines } = await supabase
    .from("supplier_bill_lines")
    .select("id, item_name, rate, product_id")
    .eq("bill_read_id", billId)
    .eq("status", "ready");

  const ready = lines ?? [];
  if (ready.length === 0) {
    return {
      error: "Koi qatar charhne ke liye tayyar nahi. Har qatar par product chunna aur rate hona zaroori hai.",
    };
  }

  let applied = 0;
  const failures: string[] = [];

  for (const line of ready) {
    const { data, error } = await supabase.rpc("fn_apply_bill_line_rate", { p_line_id: line.id });
    if (error) {
      failures.push(`${line.item_name ?? "qatar"}: ${error.message}`);
      await supabase.from("supplier_bill_lines").update({ problem: error.message }).eq("id", line.id);
      continue;
    }
    const res = data as { ok?: boolean; reason?: string } | null;
    if (res?.ok) applied += 1;
    else failures.push(`${line.item_name ?? "qatar"}: ${res?.reason ?? "charh nahi saki"}`);
  }

  // Bill tabhi "ho gaya" kehlata hai jab koi qatar baqi na ho. Aadha
  // charha hua bill khula rehta hai -- warna baqi qatarein nazar se
  // gayab ho jati hain.
  const { count: baqi } = await supabase
    .from("supplier_bill_lines")
    .select("id", { count: "exact", head: true })
    .eq("bill_read_id", billId)
    .in("status", ["draft", "ready"]);

  if ((baqi ?? 0) === 0) {
    await supabase
      .from("supplier_bill_reads")
      .update({ status: "applied", applied_at: new Date().toISOString(), applied_by: user.id })
      .eq("id", billId);
  }

  await logAudit({
    actionType: "update",
    module: "products",
    recordId: billId,
    recordLabel: bill.bill_number ?? "Supplier bill",
    description: `Bill se trade rate charhaye — ${applied} charhe, ${failures.length} nahi`,
  });

  paths(billId);

  return {
    success: applied > 0,
    applied,
    failed: failures.length,
    notice:
      failures.length === 0
        ? `${applied} products ka trade rate charh gaya.`
        : `${applied} charhe. Ye nahi charh sake: ${failures.slice(0, 5).join(" | ")}`,
    error: applied === 0 ? `Koi rate nahi charha: ${failures.slice(0, 3).join(" | ")}` : undefined,
  };
}

export async function discardBillRead(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Warehouse wale kar sakte hain." };

  const billId = String(formData.get("bill_id") ?? "");
  const { data: bill } = await supabase
    .from("supplier_bill_reads")
    .select("status")
    .eq("id", billId)
    .maybeSingle();
  if (!bill) return { error: "Bill nahi mila." };
  if (bill.status === "applied") {
    return { error: "Jis bill ke rate charh chuke hain wo hataya nahi ja sakta — indraj us se juRa hai." };
  }

  const { error } = await supabase
    .from("supplier_bill_reads")
    .update({ status: "discarded" })
    .eq("id", billId);
  if (error) return { error: error.message };

  paths(billId);
  return { success: true, notice: "Bill chhoR diya gaya." };
}
