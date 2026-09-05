"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import {
  postAssetAcquisition,
  postAssetDepreciation,
  postAssetDisposal,
  postAssetRevaluation,
  type AssetFunding,
  type DepreciationLine,
} from "@/lib/ledger/assets";

/**
 * Mustaqil asaasay -- register se farokht tak.
 *
 * Har kaam ka ek hi raasta hai, aur har raaste par tHeek wohi rok lagi
 * hai jo paise ke kisi bhi darwaze par honi chahiye:
 *
 *   1. IJAZAT. Dekhna manager tak khula hai; chalana (naya asaasa,
 *      depreciation, farokht, dobara qeemat) sirf Owner/Admin/Finance.
 *      Ye chaaron seedha nafe par asar daalte hain.
 *
 *   2. LEDGER PEHLE, RECORD BAAD MEIN NAHI -- balke DONO EK SATH. Entry
 *      post hone ke baad hi asaase par ghisai charhti hai, aur wo dono
 *      kaam database ke ek function mein hote hain. Aisa na ho to kabhi
 *      kharcha ledger mein chala jayega aur asaase par na charhega, aur
 *      us farq ka kisi ko pata bhi na chalega.
 *
 *   3. NAKAMI CHHUPTI NAHI. Entry na ban sake to record bhi nahi banta
 *      aur bulane wale ko wajah milti hai.
 */

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];

export interface AssetState {
  error?: string;
  success?: boolean;
  message?: string;
  assetId?: string;
}

async function gate(allowed: string[]): Promise<
  { ok: true; userId: string; branchId: string | null } | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_active || !allowed.includes(me.role)) {
    return { ok: false, error: "Is kaam ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }
  return { ok: true, userId: user.id, branchId: me.branch_id ?? null };
}

function num(fd: FormData, key: string): number {
  const v = Number(fd.get(key) ?? 0);
  return Number.isFinite(v) ? v : 0;
}

// =====================================================================
// 1. Naya asaasa
// =====================================================================
export async function createAsset(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const g = await gate(RUN_ROLES);
  if (!g.ok) return { error: g.error };

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  const acquiredOn = String(formData.get("acquired_on") ?? "").trim();
  const inServiceOn = String(formData.get("in_service_on") ?? "").trim() || acquiredOn;
  const cost = num(formData, "cost");
  const salvage = num(formData, "salvage_value");
  const lifeMonths = Math.round(num(formData, "life_months"));
  const method = String(formData.get("method") ?? "straight_line");
  const depRate = num(formData, "dep_rate");
  const fundingKind = String(formData.get("funding") ?? "cash");
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim();
  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const serialNo = String(formData.get("serial_no") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (name.length < 3) return { error: "Asaase ka naam likhein." };
  if (!categoryId) return { error: "Qism chunein." };
  if (!acquiredOn) return { error: "Khareed ki tareekh chunein." };
  if (cost <= 0) return { error: "Qeemat likhein." };
  if (salvage < 0 || salvage >= cost) return { error: "Bachi hui qeemat (salvage) qeemat se kam honi chahiye." };
  if (lifeMonths < 1 || lifeMonths > 1200) return { error: "Umar mahinon mein likhein (1 se 1200)." };
  if (method === "reducing_balance" && (depRate <= 0 || depRate >= 100)) {
    return { error: "Ghatti hui qeemat ke tareeqe ke liye saalana rate likhein (0 se 100 ke darmiyan)." };
  }
  if (inServiceOn < acquiredOn) return { error: "Kaam shuru hone ki tareekh khareed se pehle nahi ho sakti." };
  if (fundingKind === "cash" && !financeAccountId) {
    return { error: "Paisa kis khate se gaya -- wo chunein. Bina khate ke paisa kahin se nahi nikalta." };
  }

  const service = createServiceClient();

  const { data: cat, error: catErr } = await service
    .from("asset_categories")
    .select("id, name, asset_account")
    .eq("id", categoryId)
    .maybeSingle();
  if (catErr) return { error: `Qism nahi mili: ${catErr.message}` };
  if (!cat) return { error: "Ye qism maujood nahi." };

  const { data: codeRow, error: codeErr } = await service.rpc("fn_next_asset_code");
  if (codeErr || !codeRow) return { error: `Asaase ka number nahi bana: ${codeErr?.message ?? "maloom nahi"}` };
  const code = String(codeRow);

  const { data: asset, error: insErr } = await service
    .from("fixed_assets")
    .insert({
      code,
      name,
      category_id: categoryId,
      branch_id: g.branchId,
      supplier_id: fundingKind === "credit" && supplierId ? supplierId : null,
      acquired_on: acquiredOn,
      in_service_on: inServiceOn,
      cost,
      salvage_value: salvage,
      life_months: lifeMonths,
      method,
      dep_rate: method === "reducing_balance" ? depRate : null,
      serial_no: serialNo || null,
      location: location || null,
      notes: notes || null,
      created_by: g.userId,
    })
    .select("id")
    .single();

  if (insErr || !asset) return { error: `Asaasa darj nahi hua: ${insErr?.message ?? "maloom nahi"}` };

  const funding: AssetFunding =
    fundingKind === "cash"
      ? { kind: "cash", financeAccountId }
      : fundingKind === "credit"
        ? { kind: "credit", supplierId: supplierId || null }
        : { kind: "opening" };

  const posted = await postAssetAcquisition({
    assetId: asset.id,
    code,
    name,
    assetAccount: cat.asset_account,
    amount: cost,
    funding,
    ctx: {
      createdBy: g.userId,
      branchId: g.branchId,
      entryDate: acquiredOn,
      claims: [{ table: "fixed_assets", rowId: asset.id }],
    },
  });

  // Entry na bane to asaasa bhi nahi rehta. Warna register mein ek
  // cheez khaRi rehti jis ka ledger mein koi nishaan hi nahi -- aur
  // balance sheet us se chup chaap ghalat ho jati.
  if ("error" in posted) {
    await service.from("fixed_assets").delete().eq("id", asset.id);
    return { error: `Ledger ki entry nahi bani, is liye asaasa bhi darj nahi kiya gaya: ${posted.error}` };
  }

  await logAudit({
    actionType: "create",
    module: "assets",
    recordId: asset.id,
    recordLabel: code,
    description: `Naya asaasa: ${name} (${cat.name}) Rs ${Math.round(cost).toLocaleString()} — ${posted.entryNumber}`,
  });

  revalidatePath("/admin/finance/assets");
  revalidatePath("/admin/finance/statements");
  return { success: true, assetId: asset.id, message: `${code} darj ho gaya (${posted.entryNumber}).` };
}

// =====================================================================
// 2. Depreciation -- hisaab, phir ledger
// =====================================================================
/** Sirf ginti. Ledger ko haath nahi lagta. */
export async function computeDepreciation(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const g = await gate(RUN_ROLES);
  if (!g.ok) return { error: g.error };

  const period = String(formData.get("period") ?? "").trim();
  if (!period) return { error: "Mahina chunein." };

  const service = createServiceClient();
  const { data, error } = await service.rpc("fn_asset_dep_compute", {
    p_period: `${period}-01`,
    p_user: g.userId,
  });
  if (error) return { error: error.message };

  const { data: run } = await service
    .from("asset_depreciation_runs")
    .select("total_amount")
    .eq("id", data as string)
    .maybeSingle();

  revalidatePath("/admin/finance/assets/depreciation");
  return {
    success: true,
    message: `Hisaab ho gaya: Rs ${Math.round(Number(run?.total_amount ?? 0)).toLocaleString()}. Ab dekh kar ledger mein daalein.`,
  };
}

/** Draft run ledger mein. Yahi wo qadam hai jahan kharcha asli hota hai. */
export async function postDepreciationRun(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const g = await gate(RUN_ROLES);
  if (!g.ok) return { error: g.error };

  const runId = String(formData.get("run_id") ?? "").trim();
  if (!runId) return { error: "Kaun sa run -- wo nahi mila." };

  const service = createServiceClient();
  const { data: run, error: runErr } = await service
    .from("asset_depreciation_runs")
    .select("id, period, status, total_amount")
    .eq("id", runId)
    .maybeSingle();
  if (runErr) return { error: runErr.message };
  if (!run) return { error: "Ye run maujood nahi." };
  if (run.status === "posted") return { error: "Ye run pehle hi ledger mein ja chuka hai." };

  const { data: lines, error: lineErr } = await service
    .from("asset_depreciation_lines")
    .select("amount, expense_account, accum_account")
    .eq("run_id", runId);
  if (lineErr) return { error: lineErr.message };
  if (!lines || lines.length === 0) {
    return { error: "Is mahine ki koi ghisai nahi bani. Ledger mein khali entry nahi jati." };
  }

  const period = String(run.period);
  const label = new Date(`${period}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const depLines: DepreciationLine[] = lines.map((l) => ({
    expenseAccount: l.expense_account as string,
    accumAccount: l.accum_account as string,
    amount: Number(l.amount),
  }));

  // Entry mahine ke AAKHIRI din ki hoti hai -- ghisai poore mahine ka
  // kharcha hai, kisi ek din ka nahi.
  const monthEnd = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);
  const aaj = new Date().toISOString().slice(0, 10);
  const entryDate = monthEnd > aaj ? aaj : monthEnd;

  const posted = await postAssetDepreciation({
    runId,
    periodLabel: label,
    lines: depLines,
    ctx: {
      createdBy: g.userId,
      branchId: null,
      entryDate,
      claims: [{ table: "asset_depreciation_runs", rowId: runId }],
    },
  });
  if ("error" in posted) return { error: `Ledger ki entry nahi bani: ${posted.error}` };

  const { error: markErr } = await service.rpc("fn_asset_dep_mark_posted", {
    p_run_id: runId,
    p_entry_id: posted.id,
    p_user: g.userId,
  });
  if (markErr) {
    // Entry ban chuki hai magar asaason par nahi charhi. Ye chhupane
    // wali baat nahi -- bande ko entry ka number diya jata hai taake
    // wo dhoondha ja sake.
    return {
      error: `Entry ${posted.entryNumber} ban gayi magar asaason par ghisai nahi charhi: ${markErr.message}. Finance ko batayein.`,
    };
  }

  await logAudit({
    actionType: "create",
    module: "assets",
    recordId: runId,
    recordLabel: label,
    description: `Depreciation ${label}: Rs ${Math.round(Number(run.total_amount)).toLocaleString()} — ${posted.entryNumber}`,
  });

  revalidatePath("/admin/finance/assets");
  revalidatePath("/admin/finance/assets/depreciation");
  revalidatePath("/admin/finance/statements");
  return { success: true, message: `${label} ki depreciation ledger mein chali gayi (${posted.entryNumber}).` };
}

// =====================================================================
// 3. Farokht / kharij
// =====================================================================
export async function disposeAsset(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const g = await gate(RUN_ROLES);
  if (!g.ok) return { error: g.error };

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const disposedOn = String(formData.get("disposed_on") ?? "").trim();
  const type = String(formData.get("disposal_type") ?? "sale");
  const proceeds = num(formData, "proceeds");
  const buyer = String(formData.get("buyer_name") ?? "").trim();
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!assetId) return { error: "Asaasa nahi mila." };
  if (!disposedOn) return { error: "Tareekh chunein." };
  if (proceeds < 0) return { error: "Raqam manfi nahi ho sakti." };
  if (proceeds > 0 && !financeAccountId) {
    return { error: "Paisa kis khate mein aaya -- wo chunein." };
  }
  if (type !== "sale" && proceeds > 0) {
    return { error: "Kabaar ya kitab se kharij par paisa nahi aata. Paisa aaya hai to ye farokht hai." };
  }
  if (type !== "sale" && reason.length < 10) {
    return { error: "Kabaar ya kharij ki wajah likhein — kam az kam das harf." };
  }

  const service = createServiceClient();
  const { data: asset, error: aErr } = await service
    .from("v_fixed_assets")
    .select("id, code, name, status, cost, revaluation_adjustment, accumulated_depreciation, gross_value, book_value, asset_account, accum_account, acquired_on")
    .eq("id", assetId)
    .maybeSingle();
  if (aErr) return { error: aErr.message };
  if (!asset) return { error: "Ye asaasa maujood nahi." };
  if (asset.status !== "active") return { error: "Ye asaasa pehle hi kitab se kharij ho chuka hai." };
  if (disposedOn < String(asset.acquired_on)) {
    return { error: "Farokht ki tareekh khareed se pehle nahi ho sakti." };
  }

  const gross = Number(asset.gross_value);
  const accum = Number(asset.accumulated_depreciation);
  const book = Math.round((gross - accum) * 100) / 100;
  const gainLoss = Math.round((proceeds - book) * 100) / 100;

  const { data: disposal, error: dErr } = await service
    .from("asset_disposals")
    .insert({
      asset_id: assetId,
      disposed_on: disposedOn,
      disposal_type: type,
      proceeds,
      buyer_name: buyer || null,
      finance_account_id: proceeds > 0 ? financeAccountId : null,
      cost_at_disposal: gross,
      accum_at_disposal: accum,
      book_value: book,
      gain_loss: gainLoss,
      reason: reason || null,
      created_by: g.userId,
    })
    .select("id")
    .single();
  if (dErr || !disposal) return { error: `Farokht darj nahi hui: ${dErr?.message ?? "maloom nahi"}` };

  const posted = await postAssetDisposal({
    disposalId: disposal.id,
    code: String(asset.code),
    name: String(asset.name),
    assetAccount: String(asset.asset_account),
    accumAccount: String(asset.accum_account),
    grossValue: gross,
    accumulated: accum,
    proceeds,
    financeAccountId: proceeds > 0 ? financeAccountId : null,
    ctx: {
      createdBy: g.userId,
      branchId: null,
      entryDate: disposedOn,
      claims: [{ table: "asset_disposals", rowId: disposal.id }],
    },
  });

  if ("error" in posted) {
    await service.from("asset_disposals").delete().eq("id", disposal.id);
    return { error: `Ledger ki entry nahi bani, is liye farokht bhi darj nahi hui: ${posted.error}` };
  }

  await service.from("asset_disposals").update({ entry_id: posted.id }).eq("id", disposal.id);
  const { error: upErr } = await service
    .from("fixed_assets")
    .update({
      status: type === "sale" || type === "scrap" ? "disposed" : "written_off",
      disposed_on: disposedOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);
  if (upErr) {
    return {
      error: `Entry ${posted.entryNumber} ban gayi magar asaase ka darja nahi badla: ${upErr.message}. Finance ko batayein.`,
    };
  }

  await logAudit({
    actionType: "update",
    module: "assets",
    recordId: assetId,
    recordLabel: String(asset.code),
    description:
      `Asaasa kharij (${type}): kitabi qeemat Rs ${Math.round(book).toLocaleString()}, mila Rs ${Math.round(proceeds).toLocaleString()}, ` +
      `${gainLoss >= 0 ? "nafa" : "nuqsan"} Rs ${Math.abs(Math.round(gainLoss)).toLocaleString()} — ${posted.entryNumber}`,
  });

  revalidatePath("/admin/finance/assets");
  revalidatePath(`/admin/finance/assets/${assetId}`);
  revalidatePath("/admin/finance/statements");
  return {
    success: true,
    message: `Darj ho gaya (${posted.entryNumber}). ${gainLoss >= 0 ? "Nafa" : "Nuqsan"} Rs ${Math.abs(Math.round(gainLoss)).toLocaleString()}.`,
  };
}

// =====================================================================
// 4. Dobara qeemat
// =====================================================================
export async function revalueAsset(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const g = await gate(RUN_ROLES);
  if (!g.ok) return { error: g.error };

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const revaluedOn = String(formData.get("revalued_on") ?? "").trim();
  const newCarrying = num(formData, "new_carrying");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!assetId) return { error: "Asaasa nahi mila." };
  if (!revaluedOn) return { error: "Tareekh chunein." };
  if (newCarrying < 0) return { error: "Nayi qeemat manfi nahi ho sakti." };
  if (reason.length < 10) {
    return { error: "Dobara qeemat ki wajah likhein — kam az kam das harf. Ye wajah hamesha darj rehti hai." };
  }

  const service = createServiceClient();
  const { data: asset, error: aErr } = await service
    .from("v_fixed_assets")
    .select("id, code, name, status, cost, salvage_value, revaluation_adjustment, accumulated_depreciation, book_value, asset_account")
    .eq("id", assetId)
    .maybeSingle();
  if (aErr) return { error: aErr.message };
  if (!asset) return { error: "Ye asaasa maujood nahi." };
  if (asset.status !== "active") return { error: "Kharij ho chuke asaase ki qeemat nahi badalti." };

  const oldCarrying = Number(asset.book_value);
  const difference = Math.round((newCarrying - oldCarrying) * 100) / 100;
  if (difference === 0) return { error: "Nayi qeemat purani ke barabar hai — koi tabdeeli nahi." };

  const newAdjustment = Math.round((Number(asset.revaluation_adjustment) + difference) * 100) / 100;
  const cost = Number(asset.cost);
  const salvage = Number(asset.salvage_value);
  const accum = Number(asset.accumulated_depreciation);

  // Database ki rokein yahan pehle gin li jati hain, taake bande ko
  // saaf jumla mile, constraint ka technical paighaam nahi.
  if (cost + newAdjustment - salvage <= 0) {
    return {
      error: `Itni kami mumkin nahi: bachi hui qeemat (salvage Rs ${Math.round(salvage).toLocaleString()}) se neeche nahi ja sakti.`,
    };
  }
  if (accum > cost + newAdjustment - salvage + 0.01) {
    return {
      error: `Itni kami mumkin nahi: is par pehle hi Rs ${Math.round(accum).toLocaleString()} ki ghisai charh chuki hai.`,
    };
  }

  // Pehle is asaase par kitni barhat sarmaye mein gayi aur kitni kami
  // kharcha likhi gayi -- nayi entry ka rukh isi par hai.
  const { data: prior, error: pErr } = await service
    .from("asset_revaluations")
    .select("difference, surplus_part, expense_part")
    .eq("asset_id", assetId);
  if (pErr) return { error: pErr.message };

  let netSurplus = 0;
  let netExpense = 0;
  for (const r of prior ?? []) {
    const d = Number(r.difference);
    const s = Number(r.surplus_part);
    const e = Number(r.expense_part);
    netSurplus += d > 0 ? s : -s;
    netExpense += d < 0 ? e : -e;
  }

  let surplusPart = 0;
  let expensePart = 0;
  if (difference > 0) {
    // Barhat: pehle wo kami wapas hoti hai jo kharcha likhi gayi thi.
    expensePart = Math.min(difference, Math.max(netExpense, 0));
    surplusPart = Math.round((difference - expensePart) * 100) / 100;
  } else {
    const kami = -difference;
    surplusPart = Math.min(kami, Math.max(netSurplus, 0));
    expensePart = Math.round((kami - surplusPart) * 100) / 100;
  }

  const { data: reval, error: rErr } = await service
    .from("asset_revaluations")
    .insert({
      asset_id: assetId,
      revalued_on: revaluedOn,
      old_carrying: oldCarrying,
      new_carrying: newCarrying,
      difference,
      surplus_part: surplusPart,
      expense_part: expensePart,
      reason,
      created_by: g.userId,
    })
    .select("id")
    .single();
  if (rErr || !reval) return { error: `Darj nahi hua: ${rErr?.message ?? "maloom nahi"}` };

  const posted = await postAssetRevaluation({
    revaluationId: reval.id,
    code: String(asset.code),
    name: String(asset.name),
    assetAccount: String(asset.asset_account),
    difference,
    surplusPart,
    expensePart,
    ctx: {
      createdBy: g.userId,
      branchId: null,
      entryDate: revaluedOn,
      claims: [{ table: "asset_revaluations", rowId: reval.id }],
    },
  });

  if ("error" in posted) {
    await service.from("asset_revaluations").delete().eq("id", reval.id);
    return { error: `Ledger ki entry nahi bani, is liye qeemat bhi nahi badli: ${posted.error}` };
  }

  await service.from("asset_revaluations").update({ entry_id: posted.id }).eq("id", reval.id);
  const { error: upErr } = await service
    .from("fixed_assets")
    .update({ revaluation_adjustment: newAdjustment, updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (upErr) {
    return {
      error: `Entry ${posted.entryNumber} ban gayi magar asaase par nayi qeemat nahi charhi: ${upErr.message}. Finance ko batayein.`,
    };
  }

  await logAudit({
    actionType: "update",
    module: "assets",
    recordId: assetId,
    recordLabel: String(asset.code),
    description:
      `Dobara qeemat: Rs ${Math.round(oldCarrying).toLocaleString()} -> Rs ${Math.round(newCarrying).toLocaleString()} ` +
      `(${reason}) — ${posted.entryNumber}`,
    changes: { book_value: { pehle: oldCarrying, ab: newCarrying } },
  });

  revalidatePath("/admin/finance/assets");
  revalidatePath(`/admin/finance/assets/${assetId}`);
  revalidatePath("/admin/finance/statements");
  return { success: true, message: `Nayi kitabi qeemat Rs ${Math.round(newCarrying).toLocaleString()} (${posted.entryNumber}).` };
}

// =====================================================================
// 5. Qismein
// =====================================================================
export async function saveAssetCategory(_prev: AssetState, formData: FormData): Promise<AssetState> {
  const g = await gate(RUN_ROLES);
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const assetAccount = String(formData.get("asset_account") ?? "").trim();
  const accumAccount = String(formData.get("accum_account") ?? "").trim();
  const expenseAccount = String(formData.get("expense_account") ?? "").trim();
  const life = Math.round(num(formData, "default_life_months"));
  const method = String(formData.get("default_method") ?? "straight_line");
  const rate = num(formData, "default_rate");

  if (name.length < 3) return { error: "Qism ka naam likhein." };
  if (!assetAccount || !accumAccount || !expenseAccount) return { error: "Teenon khate chunein." };
  if (life < 1 || life > 1200) return { error: "Aam umar mahinon mein likhein (1 se 1200)." };
  if (method === "reducing_balance" && (rate <= 0 || rate >= 100)) {
    return { error: "Ghatti hui qeemat ke tareeqe ke liye saalana rate likhein." };
  }

  const service = createServiceClient();
  const row = {
    name,
    asset_account: assetAccount,
    accum_account: accumAccount,
    expense_account: expenseAccount,
    default_life_months: life,
    default_method: method,
    default_rate: method === "reducing_balance" ? rate : null,
  };

  const { error } = id
    ? await service.from("asset_categories").update(row).eq("id", id)
    : await service.from("asset_categories").insert(row);
  if (error) return { error: error.message };

  await logAudit({
    actionType: id ? "update" : "create",
    module: "assets",
    recordLabel: name,
    description: `Asaason ki qism ${id ? "badli" : "banai"}: ${name}`,
  });

  revalidatePath("/admin/finance/assets/categories");
  return { success: true, message: id ? "Qism badal di gayi." : "Nayi qism ban gayi." };
}
