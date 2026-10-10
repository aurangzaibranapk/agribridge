"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, ACC, failed } from "@/lib/ledger/rules";
import { postJournal } from "@/lib/ledger/post";
import { stockOutPlan } from "@/lib/inventory/stock-math";
import { createServiceClient } from "@/lib/supabase/service";
import { requireGrainApprover } from "@/lib/grain/approval-guard";
import { grainPayloadFromForm, formDataFromGrainPayload, type GrainPendingPayload } from "@/lib/grain/pending-payload";
import { GRAIN_SALE_DRAFT_EDITABLE } from "@/lib/grain/sale-draft-payload";
import { notifyRoles } from "@/lib/notifications";
import { grainSaleReceivableLines, resolveGrainSaleCustomer } from "@/lib/grain/sale-receivable";

export interface ActionState {
  error?: string;
  success?: boolean;
  /** Kaam ho gaya -- aur kya hua (jaise ledger entry number). */
  notice?: string;
  paymentId?: string;
  /** "Draft (Admin approval)" par save hui bikri ki id (grain_sale_drafts). */
  draftId?: string;
  /** Asal bikri (grain_sales) ki id -- Approve ke baad. */
  saleId?: string;
}

/** Bikri ka hisaab -- Draft save aur Admin review dono yahi dikhate hain. */
export interface GrainSaleSummary {
  saleDate: string;
  buyerId: string;
  grainType: string;
  warehouseId: string;
  quantity: number;
  rate: number;
  totalAmount: number;
  bardanaCost: number;
  mazdooriCost: number;
  notes: string | null;
  /** Is waqt godam mein kitna stock hai (draft par sirf maloomat -- rok Approve par lagti hai). */
  availableNow: number;
}

/** Asal bikri ka raasta -- Admin approval ke liye ikhtiyari cheezen. Normal save par koi nahi. */
interface GrainSalePostOptions {
  validateOnly?: boolean;
  draftId?: string;
  backdateReason?: string;
  saleCreatedBy?: string | null;
}

/** Kamyabi par saaf batao ke paisa kahan darj hua. */
async function grainPostedNotice(supabase: ReturnType<typeof createClient>, accountId: string, entryNumber: string | null | undefined, date: string, verb: "jama" | "nikal"): Promise<string> {
  const { data: acc } = await supabase.from("finance_accounts").select("name").eq("id", accountId).maybeSingle();
  const [y, m, d] = date.split("-");
  return `Ledger: ${entryNumber ?? "—"} · Cash book: ${acc?.name ?? "account"} (${verb}) · Tareekh: ${d}-${m}-${y}`;
}

/** Purani tareekh par journal ko wajah chahiye (post_journal_atomic). */
function saleBackdateReason(date: string, what: string): string | null {
  return date < aajKaKhana() ? `${what} ki asal tareekh ${date} (form par darj)` : null;
}

/**
 * 527: grain bikri ka gahak. Form par chuna hua, ya "naya gahak", ya buyer se
 * jura hua; kuch na ho to buyer ke naam/phone se gahak bana kar buyer se jor
 * dete hain (purani bikriyan/offline queue bina customer_id ke bhi chalti hain).
 */
async function ensureGrainSaleCustomer(
  supabase: ReturnType<typeof createClient>,
  args: { buyerId: string; formCustomerId: string | null; newName: string | null; newPhone: string | null },
): Promise<{ customerId: string } | { error: string }> {
  const db = supabase as any;
  const { data: buyer } = await db.from("buyers").select("id, business_name, contact_person, phone_number, customer_id").eq("id", args.buyerId).maybeSingle();
  if (!buyer) return { error: "Buyer nahi mila." };
  const pick = resolveGrainSaleCustomer({ formCustomerId: args.formCustomerId, buyerCustomerId: buyer.customer_id ?? null, newCustomerName: args.newName });
  let customerId: string;
  if (pick.kind === "existing") {
    const { data: c } = await db.from("customers").select("id").eq("id", pick.customerId).maybeSingle();
    if (!c) return { error: "Chuna hua gahak nahi mila." };
    customerId = c.id;
  } else {
    const name = pick.name ?? buyer.business_name ?? buyer.contact_person ?? "Grain buyer";
    const phone = (args.newPhone ?? "").trim() || buyer.phone_number || "";
    const { data: created, error } = await db
      .from("customers")
      .insert({ name, business_name: buyer.business_name ?? name, contact_person: buyer.contact_person ?? null, phone_number: phone, customer_type: "wholesale_shop" })
      .select("id")
      .single();
    if (error || !created) return { error: `Gahak nahi bana: ${error?.message ?? "jawab nahi mila"}` };
    customerId = created.id;
  }
  if (!buyer.customer_id) await db.from("buyers").update({ customer_id: customerId }).eq("id", buyer.id).is("customer_id", null);
  return { customerId };
}

async function generateSaleNumber(): Promise<string> {
  const supabase = createClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await supabase.from("grain_sale_counters").select("last_number").eq("year", year).single();
  const nextNumber = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await supabase.from("grain_sale_counters").update({ last_number: nextNumber }).eq("year", year);
  } else {
    await supabase.from("grain_sale_counters").insert({ year, last_number: nextNumber });
  }
  return `GRN-SALE-${year}-${String(nextNumber).padStart(5, "0")}`;
}

async function getGrainProductId(supabase: ReturnType<typeof createClient>, grainType: string): Promise<string | null> {
  const { data } = await supabase.from("grain_type_products").select("product_id").eq("grain_type", grainType).maybeSingle();
  return data?.product_id ?? null;
}

export async function createGrainSale(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // "Draft (Admin approval)" -- sirf tab jab staff khud chune. Warna purana
  // raasta: foran stock nikalta hai, lagat aur kharcha darj.
  if (String(formData.get("save_mode") ?? "") === "draft") return saveGrainSaleAsDraft(formData);
  return postGrainSale(formData, {});
}

async function postGrainSale(formData: FormData, opts: GrainSalePostOptions): Promise<ActionState & { summary?: GrainSaleSummary }> {
  const supabase = createClient();
  const buyerId = String(formData.get("buyer_id") ?? "");
  const grainType = String(formData.get("grain_type") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity_kg") ?? 0);
  const rate = Number(formData.get("rate_per_kg") ?? 0);
  const saleDate = String(formData.get("sale_date") ?? aajKaKhana());
  const deliveryTerm = (formData.get("delivery_term") as string) || null;
  const bardanaCost = Number(formData.get("bardana_cost") ?? 0);
  const mazdooriCost = Number(formData.get("mazdoori_cost") ?? 0);
  const costAccountId = (formData.get("cost_account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!buyerId) return { error: "Buyer select karein." };
  if (!["wheat", "rice", "maize"].includes(grainType)) return { error: "Grain type sahi select karein." };
  if (!warehouseId) return { error: "Warehouse select karein." };
  if (!quantity || quantity <= 0) return { error: "Quantity sahi likhein." };
  if (!rate || rate <= 0) return { error: "Rate sahi likhein." };
  if (bardanaCost < 0 || mazdooriCost < 0) return { error: "Bardana/Mazdoori cost sahi likhein." };
  if ((bardanaCost > 0 || mazdooriCost > 0) && !costAccountId) return { error: "Bardana/Mazdoori ka account select karein." };

  const formCustomerId = String(formData.get("customer_id") ?? "").trim() || null;
  const newCustomerName = String(formData.get("new_customer_name") ?? "").trim() || null;
  const newCustomerPhone = String(formData.get("new_customer_phone") ?? "").trim() || null;
  if (formCustomerId === "__new__" && !newCustomerName) return { error: "Naye gahak ka naam likhein." };

  const productId = await getGrainProductId(supabase, grainType);
  if (!productId) return { error: "Grain product setup nahi hai." };

  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  const available = Number(inv?.quantity_on_hand ?? 0);
  if (opts.validateOnly) {
    // Draft: stock ki rok yahan nahi (maal shayad abhi approval mein hai);
    // Approve par asal raasta poori jaanch karta hai.
    return {
      success: true,
      summary: { saleDate, buyerId, grainType, warehouseId, quantity, rate, totalAmount: quantity * rate, bardanaCost, mazdooriCost, notes, availableNow: available },
    };
  }
  const backdateReason = (what: string) =>
    opts.backdateReason && saleDate < aajKaKhana() ? opts.backdateReason : saleBackdateReason(saleDate, what);
  if (available < quantity) return { error: `Sirf ${available} kg stock available hai is warehouse mein.` };

  // Gahak stock/bikri se PEHLE tay ho -- warna bikri bina khate ke ban jati.
  const customer = await ensureGrainSaleCustomer(supabase, { buyerId, formCustomerId, newName: newCustomerName, newPhone: newCustomerPhone });
  if ("error" in customer) return { error: customer.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let remaining = quantity;
  let totalCogs = 0;
  const { data: batches } = await supabase
    .from("stock_batches")
    .select("id, remaining_quantity, unit_cost")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .gt("remaining_quantity", 0)
    .order("created_at", { ascending: true });
  const plan = stockOutPlan(quantity, available, (batches ?? []).map((batch) => ({ remaining: Number(batch.remaining_quantity), unitCost: Number(batch.unit_cost ?? 0) })));
  if (!plan.ok) return { error: plan.error };
  totalCogs = plan.cost;
  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(batch.remaining_quantity));
    const { error: batchError } = await supabase.from("stock_batches").update({ remaining_quantity: Number(batch.remaining_quantity) - take }).eq("id", batch.id);
    if (batchError) return { error: batchError.message };
    remaining -= take;
  }

  const totalAmount = quantity * rate;
  const profit = totalAmount - totalCogs - bardanaCost - mazdooriCost;
  const saleNumber = await generateSaleNumber();

  const { data: sale, error } = await supabase
    .from("grain_sales")
    .insert({
      sale_number: saleNumber,
      buyer_id: buyerId,
      customer_id: customer.customerId,
      grain_type: grainType,
      warehouse_id: warehouseId,
      quantity_kg: quantity,
      rate_per_kg: rate,
      total_amount: totalAmount,
      total_cogs: totalCogs,
      delivery_term: deliveryTerm,
      bardana_cost: bardanaCost,
      mazdoori_cost: mazdooriCost,
      profit,
      sale_date: saleDate,
      notes,
      created_by: opts.saleCreatedBy ?? user?.id ?? null,
      ...(opts.draftId ? { draft_id: opts.draftId } : {}),
    })
    .select("id")
    .single();
  if (error) {
    if (opts.draftId && error.code === "23505") return { error: "Ye draft pehle hi approve ho kar asal bikri ban chuka hai." };
    return { error: error.message };
  }

  if (inv) {
    // Ginti yahan se NAHI badalti -- harkat par trigger karta hai (129).
    // "grain_sale_out" bhi enum mein nahi tha, yani ye qatar hamesha
    // nakaam hoti thi aur anaj ka nikalna kahin darj hi nahi hota tha.
    await supabase.from("stock_movements").insert({
      inventory_id: inv.id,
      movement_type: "sale_out",
      quantity,
      reference_type: "grain_sale",
      reference_id: sale.id,
      created_by: user?.id ?? null,
    });
  }

  // 527: bikri HAMESHA gahak ka udhaar banati hai -- Dr 1100 (gahak) / Cr 4010,
  // kisi bhi tareekh par. Fail ho to error (pehle ye kabhi post hi nahi hota tha).
  const receivablePosted = await postJournal({
    description: `Grain bikri ${saleNumber} -- ${quantity}kg ${grainType} (gahak khata)`,
    sourceModule: "grain_sale",
    sourceId: sale.id,
    entryDate: saleDate,
    backdateReason: backdateReason(`Grain sale ${saleNumber}`),
    createdBy: user?.id ?? null,
    lines: grainSaleReceivableLines({ customerId: customer.customerId, amount: totalAmount, memo: `Grain bikri ${saleNumber}` }),
  });
  if ("error" in receivablePosted) return { error: `Bikri ${saleNumber} ban gayi magar gahak ka khata (Dr 1100 / Cr 4010) ledger mein nahi gaya: ${receivablePosted.error}`, saleId: sale.id };

  // Bika hua anaj Stock -- Grain (1220) se nikal kar lagat (5020) mein --
  // procurement ne Dr 1220 / Cr 5020 kiya tha, yahan ulta.
  if (totalCogs > 0) {
    const cogsPosted = await postJournal({
      description: `Anaj bika -- ${quantity}kg ${grainType} (${saleNumber}) ki lagat`,
      sourceModule: "grain_sale_cogs",
      sourceId: sale.id,
      entryDate: saleDate,
      backdateReason: backdateReason(`Grain sale ${saleNumber}`),
      createdBy: user?.id ?? null,
      lines: [
        { account: ACC.grainPurchase, debit: Math.round(totalCogs * 100) / 100 },
        { account: ACC.stockGrain, credit: Math.round(totalCogs * 100) / 100 },
      ],
    });
    if ("error" in cogsPosted) return { error: `Bikri ho gayi magar anaj ki lagat ledger mein nahi gayi: ${cogsPosted.error}` };
  }

  if ((bardanaCost > 0 || mazdooriCost > 0) && costAccountId) {
    const combinedCost = bardanaCost + mazdooriCost;
    const { data: costRow } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: costAccountId,
        transaction_type: "expense",
        category: "Grain Sale - Bardana/Mazdoori",
        amount: combinedCost,
        transaction_date: saleDate,
        notes: `Sale ${saleNumber} - Bardana Rs ${bardanaCost} + Mazdoori Rs ${mazdooriCost}`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (costRow?.id) {
      await postCashOut({
        accountId: costAccountId,
        amount: combinedCost,
        description: `Sale ${saleNumber} — Bardana + Mazdoori`,
        againstAccount: ACC.grainPurchase,
        ctx: {
          createdBy: user?.id ?? null,
          entryDate: saleDate,
          backdateReason: backdateReason(`Grain sale ${saleNumber} ka kharcha`),
          claims: [{ table: "finance_transactions", rowId: costRow.id }],
        },
      });
    }
    // Balance yahan se NAHI hilaya jata -- trigger khud hilata hai (023,
    // 127). Ye jagah baqi das se alag tarah kharab thi: balance INSERT SE
    // PEHLE parha jata tha aur baad mein likha jata tha. Jawab ittefaqan
    // theek aata tha, magar us darmiyan agar kisi aur ne usi khate par
    // kuch darj kar diya ho to us ka asar chup chaap mit jata.
  }

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/inventory");
  return { success: true, saleId: sale.id, notice: `Bikri ${saleNumber} darj ho gayi.` };
}

export async function recordGrainSalePayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const saleId = String(formData.get("sale_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const accountId = (formData.get("account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!saleId) return { error: "Missing sale id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Konsa account, wo select karein." };

  const rawDate = String(formData.get("payment_date") ?? "").trim();
  const paymentDate = rawDate || aajKaKhana();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return { error: "Payment ki tareekh sahi likhein." };
  if (paymentDate > aajKaKhana()) return { error: "Payment ki tareekh aage ki nahi ho sakti." };

  const { data: sale } = await supabase.from("grain_sales").select("total_amount, amount_received, sale_number").eq("id", saleId).single();
  if (!sale) return { error: "Sale nahi mili." };
  const remaining = Math.round((Number(sale.total_amount) - Number(sale.amount_received)) * 100) / 100;
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} baaqi hai.` };

  // Raseed ki photo (optional). Upload pehle -- fail ho to kuch darj nahi.
  let receiptPhotoUrl: string | null = null;
  const receiptPhoto = formData.get("receipt_photo");
  if (receiptPhoto instanceof File && receiptPhoto.size > 0) {
    if (!receiptPhoto.type.startsWith("image/") && receiptPhoto.type !== "application/pdf") return { error: "Raseed sirf photo (ya PDF) ho sakti hai." };
    if (receiptPhoto.size > 10 * 1024 * 1024) return { error: "Raseed ki file 10MB se choti honi chahiye." };
    const serviceClient = createServiceClient();
    const path = `sale-${Date.now()}-${receiptPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("grain-payment-receipts").upload(path, receiptPhoto);
    if (uploadError) return { error: `Raseed upload nahi hui: ${uploadError.message}` };
    receiptPhotoUrl = serviceClient.storage.from("grain-payment-receipts").getPublicUrl(path).data.publicUrl;
  }

  const clientActionRaw = String(formData.get("client_action_id") ?? "").trim();
  const clientActionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientActionRaw) ? clientActionRaw : null;

  // Payment row, sale ka amount_received, cash book aur journal (527: Dr bank /
  // Cr 1100 gahak) -- sab EK database transaction mein (migration 516). Pehle ye
  // alag alag qadam the aur tareekh hamesha "aaj" likhi jati thi.
  const { data: paid, error } = await (supabase as any).rpc("fn_record_grain_sale_payment_atomic", {
    p: {
      sale_id: saleId,
      amount,
      payment_method: paymentMethod,
      account_id: accountId,
      notes,
      payment_date: paymentDate,
      receipt_photo_url: receiptPhotoUrl,
      client_action_id: clientActionId,
      backdate_reason: String(formData.get("backdate_reason") ?? "").trim() || saleBackdateReason(paymentDate, `Grain sale ${sale.sale_number} ki wasooli`),
    },
  });
  if (error) return { error: error.message };
  if (!paid?.payment_id) return { error: "Payment ka jawab nahi mila." };

  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/finance");
  return {
    success: true,
    paymentId: paid.payment_id,
    notice: await grainPostedNotice(supabase, accountId, paid.entry_number, paymentDate, "jama"),
  };
}

// ===========================================================================
// Draft (Admin approval) -- migration 520
// ===========================================================================

const GRAIN_SALE_APPROVAL_BACKDATE_REASON = "Admin approved backdated entry";
const GRAIN_SALE_APPROVAL_STALE_MS = 10 * 60 * 1000;

function draftDateCheck(raw: string): { date: string } | { error: string } {
  const value = raw.trim() || aajKaKhana();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "Tareekh sahi likhein." };
  if (value > aajKaKhana()) return { error: "Bikri ki tareekh aage ki nahi ho sakti." };
  return { date: value };
}

function draftSummaryColumns(summary: GrainSaleSummary) {
  return {
    sale_date: summary.saleDate,
    grain_type: summary.grainType,
    buyer_id: summary.buyerId,
    warehouse_id: summary.warehouseId,
    quantity_kg: summary.quantity,
    rate_per_kg: summary.rate,
    total_amount: summary.totalAmount,
    bardana_cost: summary.bardanaCost,
    mazdoori_cost: summary.mazdooriCost,
    notes: summary.notes,
  };
}

/**
 * Staff ne "Draft (Admin approval)" chuna: wohi jaanch jo normal bikri par,
 * magar stock, batch, lagat ka journal aur kharcha -- KUCH darj nahi hota.
 */
async function saveGrainSaleAsDraft(formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const date = draftDateCheck(String(formData.get("sale_date") ?? ""));
  if ("error" in date) return { error: date.error };
  formData.set("sale_date", date.date);

  const checked = await postGrainSale(formData, { validateOnly: true });
  if (checked.error || !checked.summary) return { error: checked.error ?? "Bikri ki jaanch nahi ho saki." };

  const { data: row, error } = await (supabase as any)
    .from("grain_sale_drafts")
    .insert({ status: "pending", payload: grainPayloadFromForm(formData), created_by: user.id, ...draftSummaryColumns(checked.summary) })
    .select("id")
    .single();
  if (error || !row) return { error: `Draft save nahi hua: ${error?.message ?? "jawab nahi mila"}` };

  await notifyRoles(
    ["owner", "super_admin", "admin"],
    "Grain bikri -- Admin approval ka intezar",
    `${checked.summary.grainType} ${checked.summary.quantity.toLocaleString()} kg · Rs ${checked.summary.totalAmount.toLocaleString()} · tareekh ${checked.summary.saleDate}`,
    "/admin/grain-procurement/sale-approvals"
  );
  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/grain-procurement/sale-approvals");
  const short = checked.summary.availableNow < checked.summary.quantity
    ? ` Dhyan: godam mein abhi sirf ${checked.summary.availableNow.toLocaleString()} kg hai -- Approve se pehle stock poora hona chahiye.`
    : "";
  return {
    success: true,
    draftId: row.id,
    notice: `Bikri "Draft (Admin approval)" par save ho gayi. Stock, lagat (ledger) aur kharcha abhi darj NAHI hue -- Admin ke Approve karne par honge.${short}`,
  };
}

/**
 * Approve: wohi asal bikri ka raasta (createGrainSale) bikri ki asal tareekh
 * par, wajah "Admin approved backdated entry". Dobara click se bachao:
 * claim (pending -> approving), pehle se bani bikri ki jaanch, aur
 * grain_sales.draft_id UNIQUE.
 */
export async function approveGrainSaleDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireGrainApprover();
  if ("error" in guard) return { error: guard.error };
  const draftId = String(formData.get("draft_id") ?? "").trim();
  if (!draftId) return { error: "Draft nahi mila." };
  const service = createServiceClient() as any;
  const staleBefore = new Date(Date.now() - GRAIN_SALE_APPROVAL_STALE_MS).toISOString();

  const { data: claimed, error: claimError } = await service
    .from("grain_sale_drafts")
    .update({ status: "approving", approval_claimed_at: new Date().toISOString(), approval_claimed_by: guard.userId, last_error: null })
    .eq("id", draftId)
    .is("approved_sale_id", null)
    .or(`status.eq.pending,and(status.eq.approving,approval_claimed_at.lt."${staleBefore}")`)
    .select("id, payload, created_by")
    .maybeSingle();
  if (claimError) return { error: claimError.message };
  if (!claimed) {
    const { data: current } = await service.from("grain_sale_drafts").select("status, approved_sale_id").eq("id", draftId).maybeSingle();
    if (!current) return { error: "Draft nahi mila." };
    if (current.status === "approved") return { success: true, saleId: current.approved_sale_id ?? undefined, notice: "Ye bikri pehle hi Approve ho chuki hai -- dobara kuch darj nahi hua." };
    if (current.status === "approving") return { error: "Ye bikri abhi Approve ho rahi hai -- thori der baad safha taaza karein." };
    if (current.status === "rejected") return { error: "Ye draft Reject ho chuka hai -- Approve nahi ho sakta." };
    return { error: "Draft claim nahi ho saka, dobara koshish karein." };
  }

  const finish = async (saleId: string, lastError: string | null) => {
    await service
      .from("grain_sale_drafts")
      .update({ status: "approved", approved_sale_id: saleId, reviewed_by: guard.userId, reviewed_at: new Date().toISOString(), last_error: lastError })
      .eq("id", draftId);
  };

  const { data: already } = await service.from("grain_sales").select("id").eq("draft_id", draftId).maybeSingle();
  if (already?.id) {
    await finish(already.id, "Pichli Approve koshish mein bikri ban gayi thi; dobara posting nahi ki gayi -- stock aur ledger check karein.");
    revalidatePath("/admin/grain-procurement/sale-approvals");
    return { success: true, saleId: already.id, notice: "Asal bikri pehle hi ban chuki thi -- dobara kuch darj nahi hua." };
  }

  const result = await postGrainSale(formDataFromGrainPayload(claimed.payload as GrainPendingPayload), {
    draftId,
    backdateReason: GRAIN_SALE_APPROVAL_BACKDATE_REASON,
    saleCreatedBy: claimed.created_by ?? null,
  });

  const { data: created } = await service.from("grain_sales").select("id").eq("draft_id", draftId).maybeSingle();
  if (!created?.id) {
    await service.from("grain_sale_drafts").update({ status: "pending", approval_claimed_at: null, approval_claimed_by: null, last_error: result.error ?? "Bikri nahi bani." }).eq("id", draftId);
    revalidatePath("/admin/grain-procurement/sale-approvals");
    return { error: `Approve nahi hui (bikri nahi bani, draft Pending hi hai): ${result.error ?? "jawab nahi mila"}` };
  }

  await finish(created.id, result.error ?? null);
  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/grain-procurement/sale-approvals");
  revalidatePath("/admin/finance");
  if (result.error) return { error: `Bikri ban gayi magar ek hissa darj nahi hua: ${result.error}. Stock/ledger check karein.`, saleId: created.id };
  return { success: true, saleId: created.id, notice: result.notice ?? "Approve ho gayi: stock nikla aur lagat ledger mein bikri ki asal tareekh par darj." };
}

/** Reject: record wajah ke sath rehta hai; kuch darj nahi hota. */
export async function rejectGrainSaleDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireGrainApprover();
  if ("error" in guard) return { error: guard.error };
  const draftId = String(formData.get("draft_id") ?? "").trim();
  const reason = String(formData.get("reject_reason") ?? "").trim();
  if (!draftId) return { error: "Draft nahi mila." };
  if (reason.length < 3) return { error: "Reject ki wajah likhein." };
  const service = createServiceClient() as any;
  const { data, error } = await service
    .from("grain_sale_drafts")
    .update({ status: "rejected", reject_reason: reason, reviewed_by: guard.userId, reviewed_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Sirf Pending draft Reject ho sakta hai." };
  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/grain-procurement/sale-approvals");
  return { success: true, notice: "Draft Reject ho gaya. Record wajah ke sath mehfooz hai; kuch darj nahi hua." };
}

/** Edit: Admin draft ke khaane badal sakta hai -- dobara jaanch ke baad save; ab bhi Pending. */
export async function editGrainSaleDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireGrainApprover();
  if ("error" in guard) return { error: guard.error };
  const draftId = String(formData.get("draft_id") ?? "").trim();
  if (!draftId) return { error: "Draft nahi mila." };
  const service = createServiceClient() as any;
  const { data: row } = await service.from("grain_sale_drafts").select("id, status, payload, edit_history").eq("id", draftId).maybeSingle();
  if (!row) return { error: "Draft nahi mila." };
  if (row.status !== "pending") return { error: "Sirf Pending draft Edit ho sakta hai." };

  const before = (row.payload ?? {}) as GrainPendingPayload;
  const next: GrainPendingPayload = { ...before };
  for (const field of GRAIN_SALE_DRAFT_EDITABLE) {
    const value = formData.get(field.key);
    if (typeof value !== "string") continue;
    if (before[field.key] === undefined && value.trim() === "") continue;
    next[field.key] = value.trim();
  }
  for (const key of ["warehouse_id", "buyer_id", "customer_id", "delivery_term", "cost_account_id"]) {
    const value = formData.get(key);
    if (typeof value === "string" && (value || before[key] !== undefined)) next[key] = value;
  }
  const date = draftDateCheck(next.sale_date ?? "");
  if ("error" in date) return { error: date.error };
  next.sale_date = date.date;

  const checked = await postGrainSale(formDataFromGrainPayload(next), { validateOnly: true });
  if (checked.error || !checked.summary) return { error: checked.error ?? "Hisaab ki jaanch nahi ho saki." };

  const changes: Record<string, [string | null, string | null]> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(next)])) {
    if ((before[key] ?? null) !== (next[key] ?? null)) changes[key] = [before[key] ?? null, next[key] ?? null];
  }
  if (Object.keys(changes).length === 0) return { success: true, notice: "Koi tabdeeli nahi thi." };
  const history = Array.isArray(row.edit_history) ? row.edit_history : [];
  const { data: saved, error } = await service
    .from("grain_sale_drafts")
    .update({
      payload: next,
      ...draftSummaryColumns(checked.summary),
      updated_by: guard.userId,
      updated_at: new Date().toISOString(),
      edit_history: [...history, { at: new Date().toISOString(), by: guard.userId, changes }],
    })
    .eq("id", draftId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!saved) return { error: "Draft is dauran Approve/Reject ho gaya -- Edit save nahi hua." };
  revalidatePath("/admin/grain-procurement/sale-approvals");
  return { success: true, notice: `Edit save ho gaya (${Object.keys(changes).length} khaane badle). Ab bhi Pending hai -- kuch darj nahi hua.` };
}
