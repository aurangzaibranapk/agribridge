"use server";
import { purchaseApproveCheck, isSelfApproval, shouldPostHeldPayment } from "@/lib/approval/guards";
import { existingHeldPost, heldPaymentPostPlan, purchaseBatchDedupeKey, purchaseHeaderMatchesLines, purchaseMovementDedupeKey, receiveLockOutcome } from "@/lib/purchases/procurement-guards";
import { billNoKey, duplicateBillError, duplicateBillSources, escapeLikePattern, isDuplicateBillNoError } from "@/lib/purchases/bill-no-unique";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { payAndPost } from "@/lib/ledger/supplier-money";
import { purchaseBillTotals, parseBillNumber, purchaseLineTotal } from "@/lib/purchases/bill-math";
import { postJournal } from "@/lib/ledger/post";
import { postGoodsReceived, failed } from "@/lib/ledger/rules";
import { acceptedPurchaseAmounts, cappedPurchaseReturn, purchaseReturnLines, roundMoney } from "@/lib/finance/money-guards";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { parsePaymentTerms } from "@/lib/purchase-terms";
import { logAudit } from "@/lib/audit";
import { closeHandoff, createHandoff } from "@/lib/work-handoff";
import { requireAction } from "@/lib/access/guard";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
  purchaseId?: string;
  /** Receive ke baad ginti ka khulasa (256). */
  grn?: { received: number; damaged: number; short: number };
  /**
   * Kaam ho gaya, magar ek hissa adhoora reh gaya.
   *
   * `error` se alag: `error` kehta hai "kuch nahi hua", ye kehta hai
   * "ho gaya, magar ye dekh lein". Maal andar aa chuka ho aur sirf
   * ledger ki entry na bani ho -- wahan `error` lautana jhoot hota,
   * kyunki safha wapas jata aur banda dobara receive karne ki koshish
   * karta.
   */
  warning?: string;
}

type PurchaseItemInput = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  wholesale_rate?: number;
  mrp_rate?: number;
  sale_rate?: number;
  /** Pet mein kitni botal (438) -- rates/quantity form se FI BOTAL aa chuke hote hain. */
  units_per_pack?: number;
  batch_number?: string;
  manufacture_date?: string;
  expiry_date?: string;
  /** Bill par user ne pack/unit khud likhi -- product master mein update ho jaye. */
  pack_size_override?: string;
};

export async function createPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const supplierBillWorkspace = String(formData.get("supplier_bill_workspace") ?? "") === "on";
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!supplierId) return { error: "Supplier is required." };
  const purchaseDate = String(formData.get("purchase_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, is_active")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isAdminLevel = profile?.role === "super_admin" || profile?.role === "admin";
  const isMasterRole = isAdminLevel || profile?.role === "owner";
  if (supplierBillWorkspace && !profile?.is_active) {
    return { error: "Aapka account active nahi. Admin se rabta karein." };
  }
  if (supplierBillWorkspace && !isMasterRole) {
    return { error: "Supplier Purchase Bill sirf Admin Panel se Admin ya Owner save kar sakta hai." };
  }
  // Manzoori (259): jo khud manzoor karne wala hai us ki purchase seedha
  // approved; baqi staff ki purchase manzoori ke liye jati hai.
  // Purchase pehle submitted hoti hai. Staff ki entry maker-checker se
  // guzarti hai; Owner/Super Admin/Admin apni entry khud approve kar sakte
  // hain (Owner decision, 13 Oct 2026).
  const approver = false;
  let branchId: string | null;
  let warehouseId: string | null = null;
  if (supplierBillWorkspace) {
    warehouseId = String(formData.get("warehouse_id") ?? "").trim() || null;
    if (!warehouseId) return { error: "Bill ka receiving warehouse chunein." };
    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("id, branch_id")
      .eq("id", warehouseId)
      .eq("is_active", true)
      .maybeSingle();
    if (!warehouse) return { error: "Selected warehouse active nahi ya available nahi." };
    branchId = warehouse.branch_id;
  } else if (isAdminLevel) {
    branchId = String(formData.get("branch_id") ?? "") || null;
    if (!branchId) return { error: "Branch is required." };
  } else {
    branchId = profile?.branch_id ?? null;
    if (!branchId) return { error: "Your account is not assigned to a branch. Contact admin." };
  }
  let items: PurchaseItemInput[];
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid items data." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Add at least one product line." };
  }
  if (items.some((i) => !i || typeof i !== "object" || !i.product_id || !Number.isFinite(i.quantity) || i.quantity <= 0 || !Number.isFinite(i.unit_cost) || i.unit_cost < 0)) {
    return { error: "Har bill line mein product, sahi quantity aur purchase rate zaroor bharein." };
  }
  if (supplierBillWorkspace && Number(formData.get("expected_row_count")) !== items.length) return { error: "Bill ki kuch lines missing/unmapped hain. Draft khol kar har CSV row Product Master se link karein." };
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const { data: linkedProducts, error: productError } = await supabase.from("products").select("id").in("id", productIds).eq("is_deleted", false);
  if (productError || linkedProducts?.length !== productIds.length) return { error: "Bill ke products verify nahi hue. Existing Product Master se dobara link karein." };
  const totalAmount = purchaseBillTotals(items).subtotal;

  const readMoney = (key: string) => {
    const raw = String(formData.get(key) ?? "").replace(/,/g, "").trim();
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  };
  const discountAmount = supplierBillWorkspace ? readMoney("discount_amount") : 0;
  const taxAmount = supplierBillWorkspace ? readMoney("tax_amount") : 0;
  if (!Number.isFinite(discountAmount) || !Number.isFinite(taxAmount)) {
    return { error: "Discount aur tax ki raqam durust likhein." };
  }
  if (discountAmount > totalAmount) return { error: "Discount bill ke subtotal se zyada nahi ho sakta." };
  const recalculated = purchaseBillTotals(items, discountAmount, taxAmount);
  if (recalculated.errors.length) return { error: recalculated.errors[0] };
  const invoiceTotal = recalculated.total;
  if (supplierBillWorkspace && formData.has("invoice_total")) {
    const preview = parseBillNumber(formData.get("invoice_total"));
    if (preview === null || Math.abs(preview - invoiceTotal) > 0.005) return { error: "Bill preview aur saved total match nahi. Quantity/rate dobara check karein." };
  }

  // Adaigi ki shartein (255): poora / kuch / udhaar, aur kab tak.
  const terms = parsePaymentTerms(formData, supplierBillWorkspace ? invoiceTotal : totalAmount, purchaseDate);
  if ("error" in terms) return { error: terms.error };
  if (terms.paidNow > 0) {
    const accountId = String(formData.get("finance_account_id") ?? "").trim();
    if (!accountId) return { error: "Paid From Account chunein — payment record banne se pehle zaroori hai." };
    const { data: account, error: accountError } = await supabase.from("finance_accounts").select("id, is_active, gl_code").eq("id", accountId).maybeSingle();
    if (accountError || !account?.is_active || !account.gl_code || account.gl_code === "9999") return { error: "Payment account active aur ledger se mapped hona chahiye." };
  }


  const purchaseNumber = `PO-${Date.now()}`;
  const supplierBillNo = supplierBillWorkspace ? String(formData.get("supplier_bill_no") ?? "").trim() || null : null;
  if (supplierBillWorkspace && !supplierBillNo) {
    return { error: "Supplier invoice ka bill number zaroor likhein taa-ke wohi bill dobara save na ho." };
  }
  // Dono tables: purchases aur supplier_bill_reads. ILIKE escape, aur
  // race ka taala bill_no_key (629) hai — check-then-insert akela kaafi nahi.
  if (supplierBillWorkspace && supplierBillNo) {
    const pattern = escapeLikePattern(supplierBillNo.trim());
    const [{ data: sameBill, error: sameBillError }, { data: sameRead, error: sameReadError }] = await Promise.all([
      supabase.from("purchases").select("id, purchase_number, supplier_bill_no, status").eq("supplier_id", supplierId).neq("status", "cancelled").ilike("supplier_bill_no", pattern).limit(5),
      supabase.from("supplier_bill_reads").select("id, bill_number, purchase_id").eq("supplier_id", supplierId).ilike("bill_number", pattern).not("purchase_id", "is", null).limit(5),
    ]);
    if (sameBillError || sameReadError) return { error: `Bill number check nahi ho saka: ${sameBillError?.message ?? sameReadError?.message}` };
    const hit = duplicateBillSources({ billNo: supplierBillNo, purchases: sameBill ?? [], billReads: sameRead ?? [] });
    if (hit) return { error: duplicateBillError(supplierBillNo, hit) };
  }
  // Header + lines + held payment EK transaction (630). Koi line giri
  // to purchase bhi nahi banti — total aur adaigi aadhi lines par nahi tikte.
  // paidNow yahin held rehta hai; post sirf reviewPurchase ki manzoori par.
  const headerTotal = supplierBillWorkspace ? invoiceTotal : totalAmount;
  const held = terms.paidNow > 0
    ? {
        amount: terms.paidNow,
        payment_date: purchaseDate,
        payment_method: (formData.get("payment_method") as string) || null,
        finance_account_id: String(formData.get("finance_account_id") ?? "").trim() || null,
        requested_by: user?.id ?? null,
        posted: false,
      }
    : null;
  const { data: created, error: purchaseError } = await (supabase as any).rpc("fn_create_purchase_atomic", {
    p_purchase: {
      purchase_number: purchaseNumber,
      supplier_id: supplierId,
      branch_id: branchId,
      purchase_date: purchaseDate,
      supplier_bill_no: supplierBillNo,
      warehouse_id: warehouseId,
      status: "pending",
      review_status: "submitted",
      total_amount: headerTotal,
      invoice_total: supplierBillWorkspace ? invoiceTotal : null,
      discount_amount: supplierBillWorkspace ? discountAmount : null,
      tax_amount: supplierBillWorkspace ? taxAmount : null,
      tax_label: supplierBillWorkspace && taxAmount > 0 ? String(formData.get("tax_label") ?? "").trim() || "Tax" : null,
      payment_terms: terms.terms,
      credit_days: terms.creditDays,
      due_date: terms.dueDate,
      notes,
      payment_proof_url: supplierBillWorkspace ? (String(formData.get("payment_proof_url") ?? "").trim() || null) : null,
      created_by: user?.id ?? null,
      held_payment: held,
      bill_no_key: supplierBillWorkspace ? billNoKey(supplierBillNo, false) : null,
    },
    p_lines: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      batch_number: item.batch_number?.trim() || `${purchaseNumber}-${item.product_id.slice(0, 8)}`,
      manufacture_date: item.manufacture_date || null,
      expiry_date: item.expiry_date || null,
    })),
  });
  if (purchaseError || !created?.id) {
    if (supplierBillWorkspace && supplierBillNo && isDuplicateBillNoError(purchaseError)) {
      return { error: `Supplier bill ${supplierBillNo} pehle se save hai. Duplicate bill dobara nahi banaya.` };
    }
    return { error: purchaseError?.message ?? "Failed to create purchase." };
  }
  const purchase = { id: created.id as string };
  // 692: "maal kab tak aayega". Column abhi Live par na ho to PO phir bhi ban jaye (khamoshi se chhor dein).
  const expectedDate = String(formData.get("expected_date") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(expectedDate) && expectedDate >= purchaseDate) {
    await (supabase as any).from("purchases").update({ expected_date: expectedDate }).eq("id", purchase.id);
  }
  if (!approver && user) {
    await supabase.from("purchase_comments").insert({
      purchase_id: purchase.id,
      author_id: user.id,
      kind: "submit",
      body: "Manzoori ke liye bheji",
    });
  }
  const heldWarning: string | null = null;

  // Adaigi ki slips (436): har slip raqam + tareekh + tasveer ke sath.
  // Slip SABOOT hai, hisaab nahi -- supplier ka dena supplier_payments
  // se hi chalta hai. Slip na charh sake to purchase nahi rukti, magar
  // baat chhupti bhi nahi (warning ke sath wapas jati hai).
  let slipWarning: string | null = null;
  try {
    const slips: { amount: number; paid_on: string; image_url: string }[] = JSON.parse(
      String(formData.get("slips_json") ?? "[]")
    );
    const valid = (Array.isArray(slips) ? slips : []).filter(
      (s) =>
        s &&
        Number.isFinite(Number(s.amount)) &&
        Number(s.amount) > 0 &&
        typeof s.paid_on === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.paid_on) &&
        typeof s.image_url === "string" &&
        s.image_url.length > 0
    );
    if (valid.length > 0) {
      const { error: slipErr } = await supabase.from("purchase_payment_slips").insert(
        valid.map((s) => ({
          purchase_id: purchase.id,
          amount: Number(s.amount),
          paid_on: s.paid_on,
          image_url: s.image_url,
          created_by: user?.id ?? null,
        }))
      );
      if (slipErr) slipWarning = `Purchase ban gayi, magar adaigi ki slip mehfooz nahi hui: ${slipErr.message}`;
    }
  } catch {
    slipWarning = "Purchase ban gayi, magar slips ka data parha nahi ja saka.";
  }

  for (const item of items) {
    // Malik (19 September): "wholesale k rate, mrp k rate, sale k rate
    // yahin daal dein to product par bhi lag jayen" -- order banate
    // waqt hi cheez ke sale rate update ho jayein taake maal receive
    // hone ke baad rate baqi/products mein alag se jana na paRe. Khali
    // khana chhoRne ka matlab "abhi tabdeel nahi karna" -- 0 likhna
    // qabool nahi (usool wahi jo Rate Baqi safhe par hai).
    const rateUpdate: Record<string, number> = {};
    if (item.wholesale_rate != null && item.wholesale_rate > 0) rateUpdate.wholesale_price = item.wholesale_rate;
    if (item.mrp_rate != null && item.mrp_rate > 0) rateUpdate.mrp_price = item.mrp_rate;
    if (item.sale_rate != null && item.sale_rate > 0) rateUpdate.selling_price = item.sale_rate;
    // Pet mein kitni botal -- agli purchase par khud bhara aayega (438).
    if (item.units_per_pack != null && item.units_per_pack > 0) rateUpdate.units_per_pack = item.units_per_pack;
    if (Object.keys(rateUpdate).length > 0) {
      const { error: rateErr } = await supabase.from("products").update(rateUpdate).eq("id", item.product_id);
      // Purchase order ruk kar wapas nahi hoti agar sirf rate na charh
      // saka -- order aur maal ki ginti apni jagah theek ban chuki hai.
      if (rateErr) console.error(`purchase order se rate nahi charha (${item.product_id}):`, rateErr.message);
    }
    // Pack/unit user ne bill par likhi -- sirf tab update karo jab product mein pehle se nahi.
    if (item.pack_size_override?.trim()) {
      await supabase.from("products")
        .update({ pack_size: item.pack_size_override.trim() })
        .eq("id", item.product_id)
        .is("pack_size", null);
    }
  }
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/bills");
  revalidatePath("/admin/purchases/supplier-bill");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/products");
  revalidatePath("/admin/pos");
  await logAudit({
    actionType: "create",
    module: "purchases",
    recordId: purchase.id,
    recordLabel: supplierBillNo || purchaseNumber,
    description: supplierBillWorkspace
      ? `Supplier Purchase Bill save hua. Supplier bill ${supplierBillNo || "number nahi diya"}; amount Rs ${invoiceTotal.toLocaleString()}. Stock GRN receive par update hoga.`
      : `Purchase ${purchaseNumber} create hui.`,
  });
  return {
    success: true,
    purchaseId: purchase.id,
    message: terms.paidNow > 0
      ? `Purchase manzoori ke liye bhej di (approval pending). Rs ${terms.paidNow.toLocaleString()} ki adaigi manzoori ke baad post hogi.`
      : "Purchase manzoori ke liye bhej di (approval pending).",
    warning: [heldWarning, slipWarning].filter(Boolean).join(" ") || undefined,
  };
}

/**
 * Maal ginna (256): invoice par 50, aaye 48, toota 1, kam 1.
 *
 * Form se har line ke liye recv_<itemId> aur dmg_<itemId> aate hain;
 * kam = invoice - aaya - toota (database par bhi yehi rok lagi hai).
 * Purane form (sirf purchase_id) par sab kuch invoice jitna maan liya
 * jata hai -- wohi jo pehle hota tha.
 *
 * Stock mein sirf THEEK aaya hua maal jata hai. Toota hua stock mein
 * daal kar phir damaged_out likhna ghalat hoga: us ka paisa hum de hi
 * nahi rahe, to wo hamara nuqsan nahi -- supplier ka hai. Us ka indraj
 * purchase_items.damaged_qty mein rehta hai, v_purchase_discrepancies
 * se nazar aata hai.
 *
 * Dena (139) purchases.total_amount se banta hai. Purane purchase forms
 * mein receive par ye aaya x cost hota hai. Supplier Bill workspace mein
 * yahi raqam GRN ke baad qabool-shuda maal - us ka discount + tax hoti hai;
 * invoice ka asal kul invoice_total mein mehfooz rehta hai.
 */
export async function receivePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  if (!purchaseId) return { error: "Missing purchase id." };
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, branch_id, warehouse_id, total_amount, invoice_total, review_status, supplier_id, discount_amount, tax_amount, tax_label")
    .eq("id", purchaseId)
    .single();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status === "received") return { error: "This purchase is already marked received." };
  if (purchase.status === "cancelled") return { error: "Cancelled purchase receive nahi ho sakti." };
  // Taala database par bhi hai (259); yahan sirf saaf paighaam ke liye.
  if (purchase.review_status !== "approved") {
    return { error: "Ye purchase abhi manzoor nahi hui. Pehle Owner/Admin manzoor karein, phir maal ginein." };
  }
  const { data: items } = await supabase
    .from("purchase_items")
    .select("id, product_id, batch_id, quantity, unit_cost, products(name)")
    .eq("purchase_id", purchaseId);
  if (!items || items.length === 0) return { error: "No items on this purchase." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Purana form (sirf purchase_id) ya naya (har line ka adad)?
  const counted = items.some((i) => formData.has(`recv_${i.id}`));
  const grnNote = String(formData.get("grn_note") ?? "").trim() || null;
  const grnPhotoUrl = String(formData.get("grn_photo_url") ?? "").trim() || null;

  type Counted = {
    id: string;
    product_id: string;
    batch_id: string | null;
    unit_cost: number;
    quantity: number;
    received: number;
    damaged: number;
    short: number;
    note: string | null;
    name: string;
  };
  const rows: Counted[] = [];
  for (const item of items) {
    const rel: any = (item as any).products;
    const name: string = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? "Product";
    const quantity = Number(item.quantity);
    let received = quantity;
    let damaged = 0;
    let note: string | null = null;
    if (counted) {
      const r = String(formData.get(`recv_${item.id}`) ?? "").trim();
      const d = String(formData.get(`dmg_${item.id}`) ?? "").trim();
      received = r === "" ? 0 : Number(r);
      damaged = d === "" ? 0 : Number(d);
      note = String(formData.get(`note_${item.id}`) ?? "").trim() || null;
      if (!Number.isFinite(received) || received < 0) return { error: `${name}: "theek aaya" ka adad sahi nahi.` };
      if (!Number.isFinite(damaged) || damaged < 0) return { error: `${name}: "toota" ka adad sahi nahi.` };
    }
    const short = quantity - received - damaged;
    if (short < 0) {
      return { error: `${name}: aaya (${received}) + toota (${damaged}) invoice ki tadad (${quantity}) se zyada hai.` };
    }
    rows.push({
      id: item.id,
      product_id: item.product_id,
      batch_id: item.batch_id,
      unit_cost: Number(item.unit_cost),
      quantity,
      received,
      damaged,
      short,
      note,
      name,
    });
  }

  const totalDamaged = rows.reduce((s, r) => s + r.damaged, 0);
  const totalShort = rows.reduce((s, r) => s + r.short, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  if (totalDamaged + totalShort > 0 && !grnNote && !rows.some((r) => r.note)) {
    return { error: "Kuch toota ya kam hai -- note likhein: kya aur kyun. Baad mein supplier se yehi baat hogi." };
  }

  const invoiceGoodsSubtotal = rows.reduce((sum, r) => sum + r.quantity * r.unit_cost, 0);
  const inventoryDiscountRatio = invoiceGoodsSubtotal > 0 ? Math.min(1, Math.max(0, Number(purchase.discount_amount ?? 0) / invoiceGoodsSubtotal)) : 0;
  const prepared: Record<string, unknown>[] = [];
  for (const row of rows) {
    const stockUnitCost = Math.round(row.unit_cost * (1 - inventoryDiscountRatio) * 10000) / 10000;
    if (row.received <= 0) {
      prepared.push({
        item_id: row.id,
        product_id: row.product_id,
        batch_id: row.batch_id,
        received: row.received,
        damaged: row.damaged,
        short: row.short,
        note: row.note,
        unit_cost: row.unit_cost,
        stock_unit_cost: stockUnitCost,
        dedupe_key: purchaseMovementDedupeKey(purchaseId, row.id),
        batch_dedupe_key: purchaseBatchDedupeKey(row.id),
      });
      continue;
    }

    const { data: product } = await supabase
      .from("products")
      .select("shop_id, branch_id")
      .eq("id", row.product_id)
      .single();

    // Maal kis branch mein jayega, ye is PURCHASE ne khud chuna tha
    // (banate waqt "Branch" khana) -- product ka apna purana branch_id
    // (jab wo pehli dafa bana tha) us faisle se ooncha nahi ho sakta.
    // Pehle ulta tha: product.branch_id hamesha jeet jata, is liye
    // Central Warehouse ke liye banayi purchase bhi product ke purane
    // (Main Branch) mein chali jati thi -- maal "gum" nahi hota tha,
    // bas ghalat jagah dikhta tha (10 September).
    let warehouseId: string | null = purchase.warehouse_id ?? null;
    if (!warehouseId && product?.shop_id) {
      const { data: shopWarehouse } = await supabase.from("warehouses").select("id").eq("shop_id", product.shop_id).maybeSingle();
      warehouseId = shopWarehouse?.id ?? null;
    }
    if (!warehouseId) {
      const targetBranchId = purchase.branch_id ?? product?.branch_id;
      const { data: mainWarehouse } = await supabase.from("warehouses").select("id").eq("branch_id", targetBranchId ?? "").eq("code", "MAIN").maybeSingle();
      warehouseId = mainWarehouse?.id ?? null;
    }
    if (!warehouseId) {
      return { error: "Is product ki shop/branch ke liye koi warehouse set up nahi hai." };
    }
    prepared.push({
      item_id: row.id,
      product_id: row.product_id,
      batch_id: row.batch_id,
      warehouse_id: warehouseId,
      received: row.received,
      damaged: row.damaged,
      short: row.short,
      note: row.note,
      unit_cost: row.unit_cost,
      stock_unit_cost: stockUnitCost,
      batch_number: `${purchase.purchase_number}-${row.id.slice(0, 8)}`,
      movement_note: row.damaged + row.short > 0 ? `Invoice ${row.quantity}, aaya ${row.received}, toota ${row.damaged}, kam ${row.short}` : null,
      dedupe_key: purchaseMovementDedupeKey(purchaseId, row.id),
      batch_dedupe_key: purchaseBatchDedupeKey(row.id),
    });
  }

  // Dena utne ka jitna theek aaya. Invoice ka asal kul ek dafa mehfooz
  // hota hai (agar bill se pehle hi likha ho to wohi rehta hai).
  const acceptedTotal = roundMoney(rows.reduce((s, r) => s + r.received * r.unit_cost, 0));
  const originalGoodsTotal = rows.reduce((s, r) => s + r.quantity * r.unit_cost, 0);
  const receivedRatio = originalGoodsTotal > 0 ? Math.min(1, acceptedTotal / originalGoodsTotal) : 1;
  const { acceptedDiscount, acceptedTax, acceptedPayable } = acceptedPurchaseAmounts({
    acceptedTotal,
    discountAmount: purchase.discount_amount != null ? Number(purchase.discount_amount) : null,
    taxAmount: purchase.tax_amount != null ? Number(purchase.tax_amount) : null,
    receivedRatio,
  });
  // Lock pehle (pending -> receiving). Doosri call ya to resume hai ya
  // pehle hi received. Stock + status uske baad EK transaction (630).
  // Raqam hamesha acceptedPayable hai (round tax), warehouse ho ya na ho.
  const gate = receiveLockOutcome(purchase.status, purchase.review_status);
  if (!gate.ok) return { error: gate.error };
  const { data: lockState, error: lockError } = await (supabase as any).rpc("fn_lock_purchase_receiving", { p_id: purchaseId });
  if (lockError) return { error: lockError.message };
  if (lockState === "received") return { error: "This purchase is already marked received." };
  if (lockState === "not_approved") return { error: "Ye purchase abhi manzoor nahi hui. Pehle Owner/Admin manzoor karein, phir maal ginein." };
  if (lockState === "cancelled") return { error: "Cancelled purchase receive nahi ho sakti." };
  if (lockState === "missing") return { error: "Purchase not found." };
  if (lockState !== "locked" && lockState !== "resume") return { error: "Purchase receive nahi ho sakti." };
  const { data: committed, error: commitError } = await (supabase as any).rpc("fn_commit_purchase_receive", {
    p_id: purchaseId,
    p_lines: prepared,
    p_patch: {
      invoice_total: purchase.invoice_total ?? Number(purchase.total_amount ?? 0),
      total_amount: acceptedPayable,
      grn_photo_url: grnPhotoUrl,
      grn_note: grnNote,
      received_by: user?.id ?? null,
    },
  });
  if (commitError || !committed?.ok) {
    if (committed?.code === "received") return { error: "This purchase is already marked received." };
    await (supabase as any).rpc("fn_release_purchase_receiving", { p_id: purchaseId });
    return { error: commitError?.message ?? committed?.error ?? "Receive save nahi hua. Dobara koshish karein — stock dobara nahi barhega." };
  }

  // ===== Cheez ka MAUJOODA hawala rate =====
  //
  // Malik ka usool (4 September): "Agar aaj same product Rs100 purchase
  // rate par aaya aur kal Rs110 par, to current rate Rs110 ho jaye.
  // Lekin purane purchase records Rs110 mein overwrite nahi hone
  // chahiyen."
  //
  // Is liye yahan SIRF cheez ka apna hawala rate badla jata hai. Us
  // purchase ki qatarein, us ka batch, us ka GRN aur us ka hisaab jyun
  // ka tyun rehta hai -- wo us din ki sachchai hai, aur supplier ko us
  // bill par utna hi diya gaya tha.
  //
  // Rate ka source sirf ye raasta hai: MANZOOR SHUDA purchase, aur wohi
  // maal jo waqai andar aaya. Draft bill, AI ka parha hua bill, ya
  // rukka hua/mansookh order -- in mein se kisi se rate nahi charhta.
  // Rate ka ghalat hona baad mein har cheez ka munafa ghalat kar deta
  // hai, aur us ka pata mahinon nahi chalta.
  //
  // Tareekh aur khabar yahan se nahi bhejni parti: wo cheez par lage
  // trigger (293) se khud banti hai, chahe rate kisi bhi raaste se
  // badle.
  for (const row of rows) {
    if (row.received <= 0) continue;
    const { error: rateErr } = await supabase
      .from("products")
      .update({
        purchase_price: row.unit_cost,
        latest_purchase_rate_at: new Date().toISOString(),
        latest_purchase_id: purchaseId,
        latest_supplier_id: purchase.supplier_id ?? null,
      })
      .eq("id", row.product_id);
    // Rate na charh sake to maal wapas nahi hota -- wo andar aa chuka
    // hai. Magar chup bhi nahi raha jata: agla rate purana hi rahega
    // aur us par munafa ghalat ginta rahega.
    if (rateErr) console.error(`rate nahi charha (${row.name}):`, rateErr.message);
  }

  // ===== Ab ledger =====
  //
  // Ye qadam pehle tha hi nahi. 6 September ko Live par nikla ke Rs
  // 112,048 ka maal godam mein para tha, `suppliers.current_payable`
  // bhi theek tha -- magar ledger ko khabar hi nahi thi: khata 1200
  // (Stock) Rs -28 par khara tha aur khata 2000 mein supplier ka naam
  // tak nahi tha.
  //
  // Raqam wo hai jo QABOOL hui (received x unit_cost) -- jo toota ya
  // kam aaya us ka na stock charhta hai na dena banta.
  //
  // Rate trade (kharid) rate hai, sale rate nahi. Malik ka usool:
  // *"supplier se stock aaye ya hum individual transfer karein, wo
  // hamesha trade rate ke hisaab se count ho... jab sale karenge to
  // profit aayega."* Munafa yahin likh dena us din nafa dikhata jis din
  // abhi kuch bika hi nahi.
  //
  // Maal WAPAS nahi hota agar entry na bane -- wo andar aa chuka hai
  // aur ginti likhi ja chuki hai. Magar nakami chhupti bhi nahi: wajah
  // sath jati hai aur qatar `v_ledger_unposted` par surkh dikhti hai.
  let ledgerWarning: string | null = null;
  if (acceptedTotal > 0) {
    // Bill ka discount/tax poore invoice par likha hota hai; agar kuch
    // kam/toota nikla to yahan sirf USI hisse ka discount/tax (388) --
    // poora laga dena galat rehta agar aadha maal wapas ho gaya.
    const posted = await postGoodsReceived({
      purchaseId,
      purchaseNumber: purchase.purchase_number ?? null,
      supplierId: purchase.supplier_id ?? null,
      amount: acceptedTotal,
      discountAmount: acceptedDiscount,
      taxAmount: acceptedTax,
      taxLabel: purchase.tax_label,
      ctx: {
        createdBy: user?.id ?? null,
        branchId: purchase.branch_id ?? null,
        claims: [{ table: "purchases", rowId: purchaseId }],
      },
    });
    if (failed(posted)) {
      ledgerWarning = `Maal andar aa gaya, magar ledger tak nahi pahuncha: ${posted.error}`;
      console.error("kharid ledger tak nahi pahunchi:", posted.error);
    }
  }

  // Godam ka kaam yahan khatam hua.
  await closeHandoff("inventory.receiving", "purchases", purchaseId, user?.id ?? null);

  // Ab do kaam aage jate hain, aur dono alag logon ke hain.
  //
  // 1. Jo cheezein andar aayin, un mein se kuch ka SALE RATE nahi hota
  //    -- wo POS par nazar hi nahi aatin. Maal godam mein para rehta
  //    hai aur dukan wala samajhta hai ke stock khatam hai. Is liye
  //    khabar sirf tab jati hai jab waqai koi cheez adhoori ho.
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const { data: adhoore } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .or("sale_rate_pending.eq.true,selling_price.is.null");

  if ((adhoore ?? []).length > 0) {
    await createHandoff({
      from: "inventory.receiving",
      to: "products.rates_baqi",
      route: "/admin/products/rates-baqi",
      roles: ["warehouse", "manager", "admin", "owner", "super_admin"],
      recordTable: "purchases",
      recordId: purchaseId,
      recordLabel: purchase.purchase_number ?? null,
      branchId: purchase.branch_id ?? null,
      title: `${(adhoore ?? []).length} cheezon ka sale rate baqi hai`,
      message:
        "Maal andar aa gaya, magar jin ka sale rate nahi wo POS par nazar nahi aatin. Rate bharte hi bikne lagengi.",
      byProfileId: user?.id ?? null,
    });
  }

  // 2. Maal aa gaya to dena bhi ban gaya. Adaigi ka faisla Finance ka
  //    kaam hai, godam ka nahi -- is liye ye khabar alag jati hai.
  await createHandoff({
    from: "inventory.receiving",
    to: "purchases.bills",
    route: "/admin/purchases/bills",
    roles: ["finance", "manager", "admin", "owner", "super_admin"],
    recordTable: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number ?? null,
    branchId: purchase.branch_id ?? null,
    title: `Maal aa gaya — ab dena bana`,
    message: `Rs ${Math.round(acceptedTotal).toLocaleString()} ka maal wusool hua. Supplier ka dena ab is raqam ka hai.`,
    byProfileId: user?.id ?? null,
  });

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/bills");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/receiving");
  return {
    success: true,
    grn: { received: totalReceived, damaged: totalDamaged, short: totalShort },
    warning: ledgerWarning ?? undefined,
  };
}

// Delete Purchase - sirf Admin/Owner, reason mandatory. Poori chain
// safely reverse karta hai: stock movements -> inventory -> purchase
// items -> stock batches -> purchase. Bridge AI action-request link
// (agar koi ho) todh deta hai, audit record khud nahi hataya jata.
export async function deletePurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!reason) return { error: "Delete karne ki wajah likhna zaroori hai." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isUnrestricted = profile?.role === "owner" || profile?.role === "super_admin" || profile?.role === "admin";
  if (!isUnrestricted) return { error: "Sirf Admin/Owner purchase delete kar sakta hai." };
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number")
    .eq("id", purchaseId)
    .single();
  if (!purchase) return { error: "Purchase not found." };
  await supabase.from("bridge_ai_action_requests").update({ created_purchase_id: null }).eq("created_purchase_id", purchaseId);
  const { data: items } = await supabase
    .from("purchase_items")
    .select("batch_id")
    .eq("purchase_id", purchaseId);
  const batchIds = (items ?? []).map((i) => i.batch_id).filter(Boolean) as string[];
  if (batchIds.length > 0) {
    const { data: fullItems } = await supabase.from("purchase_items").select("product_id, quantity, batch_id").eq("purchase_id", purchaseId);
    for (const item of fullItems ?? []) {
      const { data: batch } = await supabase.from("stock_batches").select("warehouse_id").eq("id", item.batch_id ?? "").maybeSingle();
      if (batch?.warehouse_id) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("id, quantity_on_hand")
          .eq("product_id", item.product_id)
          .eq("warehouse_id", batch.warehouse_id)
          .maybeSingle();
        // Ginti yahan se hath se ghatana ab ghalat hoga: neeche jab is
        // kharidari ki harkatein mitai jati hain, trigger khud ginti
        // wapas apni jagah le aata hai (129). Dono karne se maal dugna
        // kam ho jata.
        void inv;
      }
    }
    await supabase.from("stock_movements").delete().eq("reference_type", "purchase").eq("reference_id", purchaseId);
  }
  await supabase.from("purchase_items").delete().eq("purchase_id", purchaseId);
  if (batchIds.length > 0) {
    await supabase.from("stock_batches").delete().in("id", batchIds);
  }
  const { error: deleteError } = await supabase.from("purchases").delete().eq("id", purchaseId);
  if (deleteError) return { error: deleteError.message };
  await logAudit({
    actionType: "delete",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: `Purchase delete hua. Wajah: ${reason}`,
  });
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/inventory");
  return { success: true };
}

// ---------------------------------------------------------------------
// Manzoori, wapas bhejna, radd, aur baat (259)
// ---------------------------------------------------------------------
const APPROVERS = ["owner", "super_admin", "admin"];

/**
 * Owner/Admin ka faisla: manzoor / wapas / radd. Wapas aur radd par
 * wajah likhna lazmi hai -- bina wajah ke wapas bheji hui cheez par
 * banane wala kya theek kare, use pata hi nahi hota.
 */
export async function reviewPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!["approve", "send_back", "reject"].includes(decision)) return { error: "Faisla saaf nahi." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("purchases", "approve");
  if ("error" in guard) return { error: "Purchase manzoor ya wapas sirf Owner/Admin kar sakta hai." };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, review_status, branch_id, total_amount, discount_amount, tax_amount, created_by, verified_by, supplier_id, held_payment")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };
  type Held = { amount: number; payment_date: string; payment_method: string | null; finance_account_id: string | null; posted?: boolean; client_action_id?: string | null; supplier_payment_id?: string | null; journal_entry_id?: string | null };
  const held = (purchase.held_payment as unknown as Held | null) ?? null;
  // shouldPostHeldPayment sirf "approve + amount + abhi posted nahi".
  // heldPaymentPostPlan us par UUID key aur account ki kami rokta hai —
  // purani `purchase-held-` key ledger ki ::uuid cast par girti thi aur
  // warning UI mein chup jati thi (PO-1792495620885, 20 Oct).
  const plan = held && shouldPostHeldPayment(decision, held) ? heldPaymentPostPlan(decision, held, purchaseId) : ({ post: false } as const);
  if ("error" in plan && typeof plan.error === "string" && plan.error) return { error: plan.error };
  const finishingHeld = purchase.review_status === "approved" && plan.post === true;
  if (purchase.status === "cancelled") return { error: "Radd shuda purchase par faisla nahi." };
  if (!finishingHeld && purchase.status !== "pending") return { error: "Sirf jo purchase abhi receive nahi hui, us par faisla ho sakta hai." };
  // Staff ke liye maker-checker lazmi hai. Owner/Super Admin/Admin boss
  // accounts hain: in par kisi doosre login ki dependency nahi (13 Oct).
  // Ye policy NAHI badli — sirf staff par self-approve rok hai.
  if (isSelfApproval(purchase.created_by, user.id) && !guard.caller.unrestricted) {
    return { error: "Apni banayi hui purchase par khud faisla nahi kar sakte — doosra Owner/Admin kare." };
  }
  // Maker-checker (fix/approval-queue-gaps): staff purchase verify ke baghair
  // approve nahi; verifier khud approve nahi; dobara approve nahi.
  // Pehle se manzoor + adaigi abhi posted nahi: dobara approve nahi, sirf post.
  if (decision === "approve" && !finishingHeld) {
    const { data: creator } = purchase.created_by
      ? await supabase.from("profiles").select("role").eq("id", purchase.created_by).maybeSingle()
      : { data: null };
    const chk = purchaseApproveCheck(purchase as { review_status: string | null; verified_by?: string | null }, creator?.role ?? null, user.id);
    if (!chk.ok) return { error: chk.error };
  } else if (!finishingHeld && purchase.review_status === "rejected") {
    return { error: "Ye purchase pehle hi radd ho chuki hai." };
  }
  if ((decision === "send_back" || decision === "reject") && !comment) {
    return { error: "Wapas bhejne ya radd karne ki wajah likhein -- banane wale ko yehi parhna hai." };
  }

  if (decision === "approve") {
    const { data: lineRows, error: lineErr } = await supabase.from("purchase_items").select("quantity, unit_cost").eq("purchase_id", purchaseId);
    if (lineErr) return { error: lineErr.message };
    const totals = purchaseHeaderMatchesLines({
      lines: (lineRows ?? []).map((l) => ({ quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
      totalAmount: Number(purchase.total_amount),
      discountAmount: purchase.discount_amount == null ? null : Number(purchase.discount_amount),
      taxAmount: purchase.tax_amount == null ? null : Number(purchase.tax_amount),
      heldAmount: plan.post ? plan.amount : null,
    });
    if (!totals.ok) return { error: totals.error };
  }

  // Post PEHLE. Nakami par manzoori nahi badalti, aur error seedha UI ko
  // jata hai — success + chhupi warning nahi. Key UUID hai, is liye
  // dobara click wahi journal dubara nahi likhta.
  // Pehle se supplier_payment ya journal ho (haath ki posting, doosri
  // key) to payAndPost nahi — sirf posted nishan. PO-1792495620885.
  let heldMsg: string | undefined;
  let postedHeld: Held | null = null;
  if (plan.post) {
    const { data: payRows, error: payErr } = await supabase.from("supplier_payments").select("id, purchase_id, amount").eq("purchase_id", purchaseId);
    if (payErr) return { error: `Ruki hui adaigi ki pehli payment nahi dekhi: ${payErr.message}` };
    const payments = (payRows ?? []).map((row) => ({ id: row.id, purchaseId: row.purchase_id, amount: row.amount }));
    const journalSelect = "id, client_action_id, source_module, source_id, description, is_reversal";
    const { data: byKey, error: keyErr } = await supabase.from("journal_entries").select(journalSelect).eq("client_action_id", plan.clientActionId);
    if (keyErr) return { error: `Ruki hui adaigi ka journal nahi dekha: ${keyErr.message}` };
    const { data: byPo, error: poErr } = await supabase
      .from("journal_entries")
      .select(journalSelect)
      .eq("source_module", "supplier_payment")
      .ilike("description", `%${escapeLikePattern(purchase.purchase_number)}%`);
    if (poErr) return { error: `Ruki hui adaigi ka journal nahi dekha: ${poErr.message}` };
    const payIds = payments.map((row) => row.id);
    const { data: byPay, error: byPayErr } = payIds.length
      ? await supabase.from("journal_entries").select(journalSelect).eq("source_module", "supplier_payment").in("source_id", payIds)
      : { data: [], error: null };
    if (byPayErr) return { error: `Ruki hui adaigi ka journal nahi dekha: ${byPayErr.message}` };
    const journalById = new Map<string, { id: string; client_action_id: string | null; source_module: string; source_id: string | null; description: string; is_reversal: boolean }>();
    for (const row of [...(byKey ?? []), ...(byPo ?? []), ...(byPay ?? [])]) journalById.set(row.id, row);
    const prior = existingHeldPost({
      purchaseId,
      purchaseNumber: purchase.purchase_number,
      heldAmount: plan.amount,
      clientActionId: plan.clientActionId,
      payments,
      journals: [...journalById.values()].map((row) => ({
        id: row.id,
        clientActionId: row.client_action_id,
        sourceModule: row.source_module,
        sourceId: row.source_id,
        description: row.description,
        isReversal: row.is_reversal,
      })),
    });
    if (prior.already) {
      postedHeld = {
        ...(held as Held),
        posted: true,
        client_action_id: plan.clientActionId,
        supplier_payment_id: prior.paymentId,
        journal_entry_id: prior.journalId,
        payment_date: plan.paymentDate,
        payment_method: plan.paymentMethod,
        finance_account_id: plan.accountId,
        amount: plan.amount,
      };
      heldMsg = `Ruki hui adaigi Rs ${plan.amount.toLocaleString()} pehle se lagi hui hai — dobara nahi kati.`;
    } else {
      const paid = await payAndPost(supabase, {
        supplierId: purchase.supplier_id,
        purchaseId,
        amount: plan.amount,
        paymentDate: plan.paymentDate,
        paymentMethod: plan.paymentMethod,
        accountId: plan.accountId,
        clientActionId: plan.clientActionId,
        notes: `Kharid ${purchase.purchase_number} ke waqt (manzoori par post)`,
        branchId: purchase.branch_id ?? null,
        createdBy: user.id,
        backdateReason: plan.paymentDate < aajKaKhana() ? `Purchase ${purchase.purchase_number} ki apni tareekh (${plan.paymentDate}) — adaigi manzoori tak ruki rahi.` : null,
      });
      if ("error" in paid) {
        return { error: `Ruki hui adaigi post nahi hui: ${paid.error}` };
      }
      postedHeld = { ...(held as Held), posted: true, client_action_id: plan.clientActionId, supplier_payment_id: paid.paymentId, payment_date: plan.paymentDate, payment_method: plan.paymentMethod, finance_account_id: plan.accountId, amount: plan.amount };
      heldMsg = `Ruki hui adaigi Rs ${plan.amount.toLocaleString()} post ho gayi.`;
    }
  }

  const update: Record<string, unknown> = finishingHeld
    ? {}
    : {
        review_status: decision === "approve" ? "approved" : decision === "send_back" ? "sent_back" : "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };
  if (!finishingHeld && decision === "reject") update.status = "cancelled";
  if (postedHeld) {
    update.held_payment = { ...postedHeld, posted_at: new Date().toISOString(), posted_by: user.id };
  }
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("purchases").update(update).eq("id", purchaseId);
    if (error) {
      return { error: plan.post ? `Adaigi post ho chuki hai magar purchase par nishan nahi laga: ${error.message}. Dobara Approve dabayein — doosri dafa nahi kategi.` : error.message };
    }
  }

  if (!finishingHeld) {
  await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: decision,
    body: comment || (decision === "approve" ? "Manzoor" : ""),
  });
  }

  await logAudit({
    actionType: "update",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: finishingHeld
      ? heldMsg ?? "Ruki hui adaigi post hui"
      : decision === "approve"
        ? `Purchase manzoor hui${comment ? `: ${comment}` : ""}`
        : decision === "send_back"
          ? `Purchase wapas bheji: ${comment}`
          : `Purchase radd hui: ${comment}`,
  });

  // Manzoori ke baad kaam GODAM ka ho jata hai. Pehle ye baat sirf
  // manzoor karne wale ko maloom hoti thi -- warehouse wala tab tak
  // intezar karta jab tak koi usay phone na kare. Ab khabar khud
  // jati hai: sidebar, dashboard aur ghanti, teenon par.
  // Sirf adaigi ki dobara koshish par doosri khabar nahi jati.
  if (decision === "approve" && !finishingHeld) {
    await createHandoff({
      from: "purchases",
      to: "inventory.receiving",
      route: "/admin/inventory/receiving",
      roles: ["warehouse", "manager", "admin", "owner", "super_admin"],
      recordTable: "purchases",
      recordId: purchaseId,
      recordLabel: purchase.purchase_number,
      branchId: purchase.branch_id ?? null,
      title: `Kharid manzoor hui — ${purchase.purchase_number}`,
      message: `Ab maal ginna baqi hai. Receiving par "Maal Aa Gaya" karne se hi stock charhega aur supplier ka dena banega.`,
      byProfileId: user.id,
    });
  }

  // Radd ya wapas bheji gayi purchase ka godam wala kaam khatam.
  // Khuli qatar band na karne se sidebar ki ginti barhti rehti hai aur
  // banda us par bharosa karna chhoR deta hai.
  if (decision === "reject") {
    await closeHandoff("inventory.receiving", "purchases", purchaseId, user.id);
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/purchases/bills");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/inventory/receiving");
  return { success: true, message: heldMsg ?? (decision === "approve" ? "Manzoor ho gayi." : undefined) };
}

/**
 * Tasdeeq -- Branch Manager ka kaam, sirf apni branch ki hadd tak (372,
 * Kharche 364 / Stock Count 370 wala tareeqa). Final manzoori nahi
 * badalti -- sirf agla marhala kholta hai. `reviewPurchase` hi asal
 * approve/send_back/reject karta hai, tasdeeq ke baghair bhi.
 */
export async function verifyPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  if (!purchaseId) return { error: "Missing purchase id." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("purchases", "verify");
  if ("error" in guard) return { error: guard.error };
  const { caller } = guard;

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, review_status, branch_id, created_by")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status !== "pending" || purchase.review_status !== "submitted") {
    return { error: "Ye ab tasdeeq ke marhale mein nahi hai (pehle hi tasdeeq/manzoor/wapas/radd ho chuka)." };
  }

  if (!caller.unrestricted && caller.scope !== "all") {
    if (!caller.branchId || purchase.branch_id !== caller.branchId) {
      return { error: "Ye purchase aapki branch ki nahi hai — sirf apni branch ki tasdeeq kar sakte hain." };
    }
  }
  if (purchase.created_by === user.id) {
    return { error: "Apni banayi hui purchase khud tasdeeq nahi kar sakte — doosra authorized banda kare." };
  }

  const { error } = await supabase
    .from("purchases")
    .update({ review_status: "verified", verified_by: user.id, verified_at: new Date().toISOString() })
    .eq("id", purchaseId);
  if (error) return { error: error.message };

  await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: "verify",
    body: "Tasdeeq",
  });

  await logAudit({
    actionType: "verify",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: "Branch Manager ki tasdeeq — ab Owner/Admin ki final manzoori ka intezar.",
  });

  revalidatePath("/admin/purchases");
  return { success: true, message: "Tasdeeq ho gayi — ab final manzoori ka intezar hai." };
}

/**
 * Review ke doran line (quantity/rate) mein ghalti nazar aaye to yahin
 * theek ho jaye (259 ke aage, malik 7 September): *"agar approval deni
 * hai to products ko view to karna chahiye... kisi ka rate to nahi
 * ghalat... jo edit kiya wo trackable hona chahiye."*
 *
 * Sirf jab tak maal receive NAHI hua -- receive hote hi stock aur
 * ledger isi purchase ke adad se ban jate hain, us ke baad line badalna
 * un donon ko asal se alag kar deta. Is liye rok wohi hai jo
 * `reviewPurchase` mein bhi hai.
 *
 * Har badlaav DO jagah jata hai: audit log (jaisa har jagah) aur isi
 * purchase ki apni baat ki fehrist (`purchase_comments`, kind='edit') --
 * taake jo bhi is purchase ko review kare, usay doosra safha khole
 * baghair saaf nazar aaye ke kya badla.
 */
export async function updatePurchaseItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const itemId = String(formData.get("item_id") ?? "");
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? "");
  const unitCost = Number(formData.get("unit_cost") ?? "");
  if (!itemId || !purchaseId) return { error: "Missing item id." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Quantity sahi likhein." };
  if (!Number.isFinite(unitCost) || unitCost <= 0) return { error: "Rate sahi likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !APPROVERS.includes(me.role)) {
    return { error: "Purchase ki line sirf Owner/Admin edit kar sakta hai." };
  }

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };
  if (purchase.status !== "pending") {
    return { error: "Sirf jo purchase abhi receive nahi hui, us ki line badli ja sakti hai." };
  }

  const { data: item } = await supabase
    .from("purchase_items")
    .select("id, quantity, unit_cost, products(name)")
    .eq("id", itemId)
    .eq("purchase_id", purchaseId)
    .maybeSingle();
  if (!item) return { error: "Line not found." };
  const rel: any = (item as any).products;
  const productName: string = (Array.isArray(rel) ? rel[0]?.name : rel?.name) ?? "Product";

  const oldQuantity = Number(item.quantity);
  const oldUnitCost = Number(item.unit_cost);
  if (oldQuantity === quantity && oldUnitCost === unitCost) return { success: true };

  const { error: itemErr } = await supabase
    .from("purchase_items")
    .update({ quantity, unit_cost: unitCost, line_total: purchaseLineTotal(quantity, unitCost)! })
    .eq("id", itemId);
  if (itemErr) return { error: itemErr.message };

  // Purchase ka total isi purchase ki SAB lines se dobara gina jata hai
  // -- sirf is line ka farq jama karna kisi din rounding se alag ho
  // sakta tha.
  const { data: allItems } = await supabase.from("purchase_items").select("quantity, unit_cost").eq("purchase_id", purchaseId);
  const { data: header, error: headerError } = await supabase.from("purchases").select("invoice_total, discount_amount, tax_amount").eq("id", purchaseId).single();
  if (headerError) return { error: headerError.message };
  const totals = purchaseBillTotals(allItems ?? [], header.discount_amount ?? 0, header.tax_amount ?? 0);
  if (totals.errors.length) return { error: totals.errors[0] };
  const { error: totalError } = await supabase.from("purchases").update({ total_amount: totals.total, ...(header.invoice_total !== null ? { invoice_total: totals.total } : {}) }).eq("id", purchaseId);
  if (totalError) return { error: totalError.message };

  const changes: string[] = [];
  if (oldQuantity !== quantity) changes.push(`quantity ${oldQuantity} → ${quantity}`);
  if (oldUnitCost !== unitCost) changes.push(`rate Rs ${oldUnitCost} → Rs ${unitCost}`);
  const body = `${productName}: ${changes.join(", ")}`;

  await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: "edit",
    body,
  });

  await logAudit({
    actionType: "update",
    module: "purchases",
    recordId: purchaseId,
    recordLabel: purchase.purchase_number,
    description: `Review ke doran line badli gayi: ${body}`,
    changes: {
      quantity: { pehle: oldQuantity, ab: quantity },
      unit_cost: { pehle: oldUnitCost, ab: unitCost },
    },
  });

  revalidatePath("/admin/purchases");
  return { success: true };
}

/**
 * Banane wale ka jawab: baat likhna, aur wapas aayi purchase ko dobara
 * manzoori ke liye bhejna. Koi bhi staff baat likh sakta hai; dobara
 * bhejne ke liye jawab lazmi hai.
 */
export async function commentPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const purchaseId = String(formData.get("purchase_id") ?? "");
  const resubmit = String(formData.get("resubmit") ?? "") === "1";
  const comment = String(formData.get("comment") ?? "").trim();
  if (!purchaseId) return { error: "Missing purchase id." };
  if (!comment) return { error: "Kuch likhein to sahi." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: purchase } = await supabase
    .from("purchases")
    .select("id, purchase_number, status, review_status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase not found." };

  if (resubmit) {
    if (purchase.status !== "pending" || purchase.review_status !== "sent_back") {
      return { error: "Sirf wapas aayi hui purchase dobara bheji ja sakti hai." };
    }
    // Tasdeeq bhi saaf -- content badal chuki, purani tasdeeq ab us par
    // nahi lagti. Manager ko dobara dekhna hoga.
    const { error } = await supabase
      .from("purchases")
      .update({ review_status: "submitted", reviewed_by: null, reviewed_at: null, verified_by: null, verified_at: null })
      .eq("id", purchaseId);
    if (error) return { error: error.message };
  }

  const { error: cErr } = await supabase.from("purchase_comments").insert({
    purchase_id: purchaseId,
    author_id: user.id,
    kind: resubmit ? "resubmit" : "comment",
    body: comment,
  });
  if (cErr) return { error: cErr.message };

  revalidatePath("/admin/purchases");
  return { success: true };
}

export async function getNextSupplierBillNo(): Promise<{ billNo: string } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const service = createServiceClient();
  const year = new Date().getFullYear();
  const prefix = `SB-${year}-`;

  const { data } = await service
    .from("purchases")
    .select("supplier_bill_no")
    .like("supplier_bill_no", `${prefix}%`)
    .order("supplier_bill_no", { ascending: false })
    .limit(1);

  let next = 1;
  if (data?.[0]?.supplier_bill_no) {
    const num = parseInt(String(data[0].supplier_bill_no).replace(prefix, ""), 10);
    if (!isNaN(num)) next = num + 1;
  }

  return { billNo: `${prefix}${String(next).padStart(3, "0")}` };
}

/**
 * Supplier ko maal wapas. Stock aur 1195 Tax Recoverable ulta hota hai,
 * supplier ka dena utni raqam kam.
 */
export async function recordPurchaseReturn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Purchase return kitab mein likhna");
  if (!gate.ok) return { error: gate.error };
  const service = createServiceClient();
  const purchaseId = String(formData.get("purchase_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const requestedQty = Number(formData.get("quantity") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!purchaseId || !productId) return { error: "Purchase aur product zaroori hain." };
  if (reason.length < 5) return { error: "Wapas karne ki wajah likhein." };

  const { data: purchase } = await service
    .from("purchases")
    .select("id, purchase_number, supplier_id, status, tax_amount, warehouse_id, branch_id")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { error: "Purchase nahi mili." };
  if (purchase.status !== "received") return { error: "Sirf receive ho chuki purchase se maal wapas hota hai." };

  const { data: lines } = await service
    .from("purchase_items")
    .select("product_id, quantity, received_qty, unit_cost, batch_id")
    .eq("purchase_id", purchaseId);
  const mine = (lines ?? []).filter((line) => line.product_id === productId);
  if (mine.length === 0) return { error: "Ye product is purchase par nahi." };
  const receivedQty = mine.reduce((sum, line) => sum + Number(line.received_qty ?? line.quantity ?? 0), 0);
  const goodsOnLine = mine.reduce((sum, line) => sum + Number(line.received_qty ?? line.quantity ?? 0) * Number(line.unit_cost), 0);
  const unitCost = receivedQty > 0 ? goodsOnLine / receivedQty : Number(mine[0].unit_cost);
  const purchaseGoods = (lines ?? []).reduce(
    (sum, line) => sum + Number(line.received_qty ?? line.quantity ?? 0) * Number(line.unit_cost),
    0
  );
  const { data: prior } = await service
    .from("purchase_returns")
    .select("quantity")
    .eq("purchase_id", purchaseId)
    .eq("product_id", productId);
  const alreadyReturnedQty = (prior ?? []).reduce((sum, row) => sum + Number(row.quantity), 0);
  const capped = cappedPurchaseReturn({
    receivedQty,
    unitCost,
    purchaseGoods,
    purchaseTax: Number(purchase.tax_amount ?? 0),
    alreadyReturnedQty,
    requestedQty,
  });
  if ("error" in capped) return { error: capped.error };

  const draft = purchaseReturnLines({
    goodsAmount: capped.goodsAmount,
    taxAmount: capped.taxAmount,
    supplierId: purchase.supplier_id,
    memo: `Purchase return ${purchase.purchase_number ?? purchaseId} — ${reason}`,
  });
  if ("error" in draft) return { error: draft.error };

  const { data: row, error: insErr } = await service
    .from("purchase_returns")
    .insert({ purchase_id: purchaseId, product_id: productId, quantity: capped.quantity, reason })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "Return row nahi bani." };

  const journal = await postJournal({
    description: draft.lines[0]?.memo ?? "Purchase return",
    sourceModule: "purchase_return",
    sourceId: row.id,
    createdBy: gate.userId,
    claims: [{ table: "purchase_returns", rowId: row.id }],
    lines: draft.lines,
  });
  if ("error" in journal) {
    await service.from("purchase_returns").delete().eq("id", row.id);
    return { error: `1195 / stock ulta nahi ho saka: ${journal.error}` };
  }

  const stock = await reducePurchaseReturnStock(service, {
    productId,
    quantity: capped.quantity,
    warehouseId: purchase.warehouse_id,
    branchId: purchase.branch_id,
    batchId: mine.find((line) => line.batch_id)?.batch_id ?? null,
    returnId: row.id,
    createdBy: gate.userId,
  });
  if (stock) {
    return {
      success: true,
      message: `Return kitab mein darj (${journal.entryNumber}). Tax Recoverable 1195 ulta hua. Stock kam nahi hua: ${stock}`,
    };
  }

  revalidatePath("/admin/purchases");
  revalidatePath("/admin/money-trail");
  return { success: true, message: `Return kitab mein darj (${journal.entryNumber}). Stock kam hua aur 1195 ulta hua.` };
}

async function reducePurchaseReturnStock(
  service: ReturnType<typeof createServiceClient>,
  input: {
    productId: string;
    quantity: number;
    warehouseId: string | null;
    branchId: string | null;
    batchId: string | null;
    returnId: string;
    createdBy: string;
  }
): Promise<string | null> {
  let warehouseId = input.warehouseId;
  if (!warehouseId && input.branchId) {
    const { data: main } = await service.from("warehouses").select("id").eq("branch_id", input.branchId).eq("code", "MAIN").maybeSingle();
    warehouseId = main?.id ?? null;
  }
  if (!warehouseId) return "warehouse nahi mila";
  const { data: inventory } = await service
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("product_id", input.productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();
  if (!inventory) return "stock ki qatar nahi mili";
  if (Number(inventory.quantity_on_hand) + 0.0001 < input.quantity) {
    return `godam mein ${inventory.quantity_on_hand} hai, wapas ${input.quantity} maanga`;
  }
  const { error } = await service.from("stock_movements").insert({
    inventory_id: inventory.id,
    movement_type: "adjustment_decrease",
    quantity: input.quantity,
    reference_type: "purchase_return",
    reference_id: input.returnId,
    notes: "Supplier ko maal wapas",
    created_by: input.createdBy,
  });
  if (error) return error.message;
  if (input.batchId) {
    const { data: batch } = await service.from("stock_batches").select("remaining_quantity").eq("id", input.batchId).maybeSingle();
    if (batch) {
      const left = Math.max(0, Number(batch.remaining_quantity) - input.quantity);
      await service.from("stock_batches").update({ remaining_quantity: left }).eq("id", input.batchId);
    }
  }
  return null;
}
