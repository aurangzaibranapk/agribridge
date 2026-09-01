"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { readSupplierBillLines } from "@/lib/ai/bill-lines-client";
import { createClient } from "@/lib/supabase/server";

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
export async function createBillRead(_prev: BillRateState, formData: FormData): Promise<BillRateState> {
  const { supabase, user, ok } = await gate();
  if (!user) return { error: "Login karein." };
  if (!ok) return { error: "Bill se rate charhana sirf Owner, Admin ya Warehouse wale ka kaam hai." };

  const imageUrl = String(formData.get("image_url") ?? "").trim();
  if (!imageUrl) return { error: "Bill ki tasveer lagayein." };

  const supplierId = (formData.get("supplier_id") as string) || null;

  const { data: bill, error } = await supabase
    .from("supplier_bill_reads")
    .insert({ image_url: imageUrl, supplier_id: supplierId, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const reading = await readSupplierBillLines(imageUrl);

  if (!reading) {
    paths(bill.id);
    return {
      success: true,
      billId: bill.id,
      notice:
        "Bill charh gaya, magar AI se parha nahi ja saka (ho sakta hai GEMINI_API_KEY na laga ho). Qatarein khud likh lein.",
    };
  }

  await supabase
    .from("supplier_bill_reads")
    .update({
      supplier_name_raw: reading.supplierName,
      bill_number: reading.billNumber,
      bill_date: reading.billDate,
      bill_total: reading.billTotal,
      ai_raw: JSON.parse(JSON.stringify(reading)),
      ai_read_at: new Date().toISOString(),
    })
    .eq("id", bill.id);

  if (reading.lines.length > 0) {
    // Naam se apne aap milaan -- sirf poora naam milne par. Ye phir
    // bhi tajweez hai: qatar 'draft' hi rehti hai, 'ready' nahi, taake
    // banda har ek par nazar daale.
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

    const rows = reading.lines.map((line, i) => {
      let productId: string | null = null;
      if (line.itemName) {
        const direct = byName.get(matchKey(line.itemName));
        const withPack = line.packSize ? byName.get(matchKey(`${line.itemName}${line.packSize}`)) : undefined;
        productId = (withPack || direct) ?? null;
        if (productId === "") productId = null;
      }

      return {
        bill_read_id: bill.id,
        line_no: i + 1,
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

    const { error: lineErr } = await supabase.from("supplier_bill_lines").insert(rows);
    if (lineErr) {
      paths(bill.id);
      return {
        success: true,
        billId: bill.id,
        notice: `Bill charh gaya magar qatarein mehfooz nahi hui: ${lineErr.message}`,
      };
    }
  }

  await logAudit({
    actionType: "create",
    module: "products",
    recordId: bill.id,
    recordLabel: reading.billNumber ?? "Supplier bill",
    description: `Supplier ka bill parha gaya — ${reading.lines.length} qatarein`,
  });

  paths(bill.id);

  // Kitni qatarein aisi hain jin ka rate bill par saaf nahi tha. Ye
  // adad chhupana nahi chahiye -- warna banda samajhta hai sab parh
  // liya gaya.
  const binaRate = reading.lines.filter((l) => l.rate == null).length;

  return {
    success: true,
    billId: bill.id,
    notice:
      `${reading.lines.length} qatarein parhi gayin.` +
      (binaRate > 0 ? ` In mein se ${binaRate} ka rate bill par saaf nahi tha — wo khali hain.` : ""),
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

  if (error) return { error: error.message };

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
