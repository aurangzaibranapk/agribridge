"use server";
import { grainBagCalculation } from "@/lib/grain/bag-calculation";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, postWalletMovement, ACC, failed } from "@/lib/ledger/rules";
import { postJournal } from "@/lib/ledger/post";
import { createBatch } from "@/lib/inventory/batch-ledger";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";
import { sendDeptMail, mailWrapper } from "@/lib/mailer";

export interface ActionState {
  error?: string;
  success?: boolean;
  entryId?: string;
  paymentId?: string;
  /** Kaam ho gaya -- aur kya hua, wo staff ko batane wala jumla. */
  notice?: string;
}

interface InlineExpense {
  category: string;
  description: string;
  amount: number;
  account_id: string;
}

async function getGrainProductId(supabase: ReturnType<typeof createClient>, grainType: string): Promise<string | null> {
  const { data } = await supabase.from("grain_type_products").select("product_id").eq("grain_type", grainType).maybeSingle();
  return data?.product_id ?? null;
}

/**
 * Purani tareekh ki entry ki wajah. post_journal_atomic purani tareekh par
 * wajah ke baghair journal rad kar deta hai -- pehle yahan wajah di hi nahi
 * jati thi, is liye pichli tareekh ki grain entry ka stock journal chup chaap
 * reh jata tha.
 */
function grainBackdateReason(date: string, what: string): string | null {
  return date < aajKaKhana() ? `${what} ki asal tareekh ${date} (form par darj)` : null;
}

/** Payment form ki tareekh: khali = aaj, aage ki tareekh mana. */
function grainPaymentDate(raw: FormDataEntryValue | null): { date: string } | { error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { date: aajKaKhana() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: "Payment ki tareekh sahi likhein." };
  if (value > aajKaKhana()) return { error: "Payment ki tareekh aage ki nahi ho sakti." };
  return { date: value };
}

/** Raseed/saboot ki photo -- upload na ho to payment bhi nahi (aadha kaam nahi). */
async function uploadGrainReceipt(serviceClient: ReturnType<typeof createServiceClient>, file: File): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") return { error: "Raseed sirf photo (ya PDF) ho sakti hai." };
  if (file.size > 10 * 1024 * 1024) return { error: "Raseed ki file 10MB se choti honi chahiye." };
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const { error: uploadError } = await serviceClient.storage.from("grain-payment-receipts").upload(path, file);
  if (uploadError) return { error: `Raseed upload nahi hui: ${uploadError.message}` };
  const { data } = serviceClient.storage.from("grain-payment-receipts").getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Kamyabi par saaf batao ke paisa kahan darj hua. */
async function grainPostedNotice(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  entryNumber: string | null | undefined,
  date: string,
  verb: "jama" | "nikal",
  creditDeduction = 0
): Promise<string> {
  const { data: acc } = await supabase.from("finance_accounts").select("name").eq("id", accountId).maybeSingle();
  const [y, m, d] = date.split("-");
  const credit = creditDeduction > 0 ? ` · Rs ${creditDeduction.toLocaleString()} kisan ke purane udhaar se kata` : "";
  return `Ledger: ${entryNumber ?? "—"} · Cash book: ${acc?.name ?? "account"} (${verb}) · Tareekh: ${d}-${m}-${y}${credit}`;
}

function validClientActionId(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export async function createGrainEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const sellerType = String(formData.get("seller_type") ?? "farmer");
  const farmerId = sellerType === "farmer" ? String(formData.get("farmer_id") ?? "") : null;
  const partyId = sellerType === "party" ? String(formData.get("party_id") ?? "") : null;
  const grainType = String(formData.get("grain_type") ?? "");
  const entryDate = String(formData.get("entry_date") ?? aajKaKhana());
  const grossWeight = Number(formData.get("gross_weight_kg") ?? 0);
  let cutPercentage = Number(formData.get("cut_percentage") ?? 0);
  const rate = Number(formData.get("rate_per_kg") ?? 0);
  const chungiType = String(formData.get("chungi_type") ?? "cash");
  let chungiKg = Number(formData.get("chungi_kg") ?? 0);
  let chungiAmountInput = Number(formData.get("chungi_amount") ?? 0);
  const moisture = formData.get("moisture_percentage") ? Number(formData.get("moisture_percentage")) : null;
  const quality = (formData.get("quality_grade") as string) || null;
  const warehouseId = (formData.get("warehouse_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  const hasExpenseAnswer = String(formData.get("has_expense") ?? "");
  if (hasExpenseAnswer !== "yes" && hasExpenseAnswer !== "no") {
    return { error: "Pehle batayein: is entry ke sath koi Expense (Diesel/Mazdoori/Bardana) hai ya nahi." };
  }
  let inlineExpenses: InlineExpense[] = [];
  if (hasExpenseAnswer === "yes") {
    try {
      inlineExpenses = JSON.parse(String(formData.get("expenses_json") ?? "[]"));
    } catch {
      return { error: "Expenses sahi tarah nahi mile." };
    }
    if (inlineExpenses.length === 0) return { error: "Aap ne 'Haan' kaha hai, kam az kam ek Expense add karein." };
    for (const exp of inlineExpenses) {
      if (!exp.category || !exp.amount || exp.amount <= 0 || !exp.account_id) {
        return { error: "Har Expense ki Category, Amount, aur Account bharna zaroori hai." };
      }
    }
  }

  let bagResult: ReturnType<typeof grainBagCalculation> | null = null;
  if (formData.get("bag_calculation") === "on") {
    const cutBasis = String(formData.get("cut_basis"));
    const chungiBasis = String(formData.get("chungi_basis"));
    if (cutBasis !== "per_bag" && cutBasis !== "total_weight" && cutBasis !== "percentage") return {error: "Cut basis sahi select karein."};
    if (chungiBasis !== "per_bag" && chungiBasis !== "total") return {error: "Chungi basis sahi select karein."};
    if (chungiType !== "cash" && chungiType !== "grain") return {error: "Chungi type sahi select karein."};
    bagResult = grainBagCalculation({grainType, grossKg: grossWeight, ratePerMaund: rate, cutBasis,
      bagWeightKg: Number(formData.get("bag_weight_kg") ?? 0) || null,
      cutKg: Number(formData.get("cut_kg_input") ?? 0), cutGrams: Number(formData.get("cut_grams_input") ?? 0),
      cutPercentage: Number(formData.get("preset_cut_percentage") ?? 0), chungiBasis, chungiType,
      chungiValue: Number(formData.get("chungi_value") ?? 0)});
    if (bagResult.errors.length) return {error: bagResult.errors[0]};
    cutPercentage = bagResult.cutPercentage;
    chungiKg = bagResult.chungiKg;
    chungiAmountInput = bagResult.chungiAmount;
  }
  if (![grossWeight, cutPercentage, rate, chungiKg, chungiAmountInput].every(Number.isFinite)) return {error: "Weight, rate, cut aur chungi valid numbers mein likhein."};
  if (sellerType === "farmer" && !farmerId) return { error: "Farmer select karein." };
  if (sellerType === "party" && !partyId) return { error: "Party select karein." };
  if (!["wheat", "rice", "maize"].includes(grainType)) return { error: "Invalid grain type." };
  if (!grossWeight || grossWeight <= 0) return { error: "Gross weight must be greater than zero." };
  if (cutPercentage < 0 || cutPercentage > 100) return { error: "Cut percentage sahi likhein (0-100)." };
  if (!rate || rate <= 0) return { error: "Rate must be greater than zero." };
  if (!warehouseId) return { error: "Warehouse select karein (stock yahan add hoga)." };
  if (!["cash", "grain"].includes(chungiType)) return { error: "Chungi type sahi select karein." };

  const cutKg = bagResult?.cutKg ?? grossWeight * (cutPercentage / 100);
  const netWeight = bagResult?.netKg ?? grossWeight - cutKg;
  // rate field mein per-maund rate aata hai -- kg mein convert: rate/40
  const totalAmount = bagResult?.total ?? (netWeight / 40) * rate;
  const chungiAmount = bagResult?.chungiAmount ?? (chungiType === "grain" ? (chungiKg / 40) * rate : chungiAmountInput);
  if (chungiAmount < 0) return { error: "Chungi amount sahi likhein." };
  if (chungiAmount > totalAmount) return { error: "Chungi amount total value se zyada nahi ho sakta." };
  const payableToSeller = bagResult?.payable ?? totalAmount - chungiAmount;

  const makePayment = String(formData.get("make_payment") ?? "");
  if (makePayment !== "yes" && makePayment !== "no") {
    return { error: "Pehle batayein: is waqt Payment karni hai ya nahi." };
  }
  let paymentAmount = 0;
  let paymentMethod: string | null = null;
  let paymentAccountId: string | null = null;
  let receiptPhoto: File | null = null;
  if (makePayment === "yes") {
    paymentAmount = Number(formData.get("payment_amount") ?? 0);
    paymentMethod = (formData.get("payment_method") as string) || null;
    paymentAccountId = (formData.get("payment_account_id") as string) || null;
    if (!paymentAmount || paymentAmount <= 0) return { error: "Payment Amount sahi likhein." };
    if (paymentAmount > payableToSeller) return { error: `Payment, Payable Amount (Rs ${payableToSeller.toLocaleString()}) se zyada nahi ho sakti.` };
    if (!paymentAccountId) return { error: "Konsa account se paisa gaya, wo select karein." };
    const photoField = formData.get("receipt_photo");
    if (paymentMethod === "cash") {
      if (!(photoField instanceof File) || photoField.size === 0) {
        return { error: "Cash payment ke liye Farmer ki signed Receiving ki photo attach karna zaroori hai." };
      }
    }
    if (photoField instanceof File && photoField.size > 0) receiptPhoto = photoField;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entry, error } = await (supabase as any)
    .from("grain_procurement_entries")
    .insert({
      farmer_id: farmerId,
      party_id: partyId,
      grain_type: grainType,
      entry_date: entryDate,
      gross_weight_kg: grossWeight,
      cut_percentage: cutPercentage,
      cut_kg: cutKg,
      weight_kg: netWeight,
      chungi_type: chungiType,
      chungi_kg: chungiType === "grain" ? chungiKg : 0,
      chungi_amount: chungiAmount,
      bag_weight_kg: bagResult?.bagKg ?? null,
      bag_count: bagResult?.bags ?? null,
      cut_per_bag_kg: bagResult && bagResult.bagKg && String(formData.get("cut_basis")) === "per_bag" ? bagResult.unitCutKg : null,
      chungi_per_bag_kg: bagResult && bagResult.bagKg && chungiType === "grain" && String(formData.get("chungi_basis")) === "per_bag" ? Number(formData.get("chungi_value") ?? 0) : null,
      bag_calculation_basis: bagResult ? String(formData.get("cut_basis")) : null,
      moisture_percentage: moisture,
      quality_grade: quality,
      rate_per_kg: rate,
      total_amount: totalAmount,
      warehouse_id: warehouseId,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (farmerId) {
    const { data: grainWallet } = await supabase.from("wallets").select("id").eq("owner_type", "farmer").eq("owner_id", farmerId).single();
    if (grainWallet) {
      // Pehle yahan type "grain_income" likha tha jo wallet ki fehrist
      // mein hai hi nahi -- is liye ye entry chup chaap nakaam ho jati
      // thi aur kisan ka wallet khali reh jata tha.
      const { data: grainWalletRow } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: grainWallet.id,
          type: "manual_adjustment",
          direction: "credit",
          amount: payableToSeller,
          balance_after: 0,
          reference_type: "grain_procurement_entry",
          reference_id: entry.id,
          notes: `Grain: ${netWeight}kg, ${grainType}, ${entryDate}`,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (grainWalletRow?.id) {
        await postWalletMovement({
          ownerType: "farmer",
          ownerId: farmerId,
          amount: payableToSeller,
          direction: "credit",
          against: ACC.grainPurchase,
          description: `Grain khareed — ${netWeight}kg ${grainType}`,
          ctx: {
            createdBy: user?.id ?? null,
            entryDate,
            backdateReason: grainBackdateReason(entryDate, "Grain entry"),
            claims: [{ table: "wallet_transactions", rowId: grainWalletRow.id }],
          },
        });
      }
    }
  }

  const productId = await getGrainProductId(supabase, grainType);
  if (productId) {
    const { data: existingInv } = await supabase
      .from("inventory")
      .select("id, quantity_on_hand")
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();
    // Ginti yahan se NAHI badalti -- wo harkat par trigger karta hai (129).
    let inventoryId: string;
    if (existingInv) {
      inventoryId = existingInv.id;
    } else {
      const { data: newInv } = await supabase
        .from("inventory")
        .insert({ warehouse_id: warehouseId, product_id: productId })
        .select("id")
        .single();
      inventoryId = newInv?.id ?? "";
    }
    if (inventoryId) {
      // Pehle yahan "grain_procurement_in" likha hua tha. Wo lafz
      // stock_movement_type enum mein hai hi nahi, is liye ye qatar
      // HAMESHA nakaam hoti thi -- aur error kabhi parha nahi jata tha.
      // Yani anaj ka stock sirf upar wali hath ki likhai se barhta tha
      // aur us ka koi kaghaz nahi banta tha. "purchase_in" wohi baat hai
      // jo yahan ho rahi hai: kisan se maal khareeda gaya.
      const { error: movementError } = await supabase.from("stock_movements").insert({
        inventory_id: inventoryId,
        movement_type: "purchase_in",
        quantity: netWeight,
        reference_type: "grain_procurement",
        reference_id: entry.id,
        created_by: user?.id ?? null,
      });
      if (movementError) return { error: `Anaj ka stock darj nahi hua: ${movementError.message}` };
    }
    // Batch ka error ab chhupaya nahi jata, aur anaj ki qeemat ledger mein
    // bhi jati hai: khareed 5020 (expense) mein likhi jati hai, is liye
    // godam mein para anaj us se nikal kar Stock -- Grain (1220) mein:
    // Dr 1220 / Cr 5020. Bechne par grain-sales ulta karta hai.
    // (Pehle ye batch ledger mein kabhi nahi gaya -- 9 Oct ko Rs 57 lakh
    // ka gandum batch mein tha magar khata 1200/1220 mein sifar.)
    // Form ka rate per-maund hota hai; stock_batches ka unit_cost per-kg
    // hona chahiye (Rs 4,500 per maund = Rs 112.50/kg).
    const unitCost = netWeight > 0 ? totalAmount / netWeight : 0;
    const batch = await createBatch(supabase, {
      productId,
      warehouseId,
      qty: netWeight,
      unitCost,
      batchNumber: `GRAIN-${entry.id.slice(0, 8)}`,
    });
    if (batch.error) return { error: `Anaj ka batch nahi bana: ${batch.error}` };
    if (totalAmount > 0) {
      const posted = await postJournal({
        description: `Anaj godam mein -- ${netWeight}kg ${grainType}`,
        sourceModule: "grain_procurement",
        sourceId: entry.id,
        entryDate,
        backdateReason: grainBackdateReason(entryDate, "Grain entry"),
        createdBy: user?.id ?? null,
        lines: [
          { account: ACC.stockGrain, debit: Math.round(totalAmount * 100) / 100 },
          { account: ACC.grainPurchase, credit: Math.round(totalAmount * 100) / 100 },
        ],
      });
      if ("error" in posted) return { error: `Anaj ka stock ledger mein nahi gaya: ${posted.error}` };
    }
  }

  for (const exp of inlineExpenses) {
    await supabase.from("grain_expenses").insert({
      expense_date: entryDate,
      category: exp.category,
      description: exp.description || exp.category,
      amount: exp.amount,
      account_id: exp.account_id,
      entry_id: entry.id,
      created_by: user?.id ?? null,
    });
    const { data: opExpRow } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: exp.account_id,
        transaction_type: "expense",
        category: "Grain Operations",
        amount: exp.amount,
        transaction_date: entryDate,
        notes: `${exp.description || exp.category} (Grain Operations - Entry linked)`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (opExpRow?.id) {
      await postCashOut({
        accountId: exp.account_id,
        amount: Number(exp.amount),
        description: `${exp.description || exp.category} (Grain Operations)`,
        againstAccount: ACC.grainPurchase,
        ctx: {
          createdBy: user?.id ?? null,
          entryDate,
          backdateReason: grainBackdateReason(entryDate, "Grain entry ka kharcha"),
          claims: [{ table: "finance_transactions", rowId: opExpRow.id }],
        },
      });
    }
    // Balance yahan se NAHI hilaya jata. finance_transactions mein qatar
    // daalte hi trigger khud hila deta hai (023, aur 127 se ab mitane aur
    // badalne par bhi). Pehle yahan dobara bhi hilaya jata tha, yani Rs
    // 1,000 ka asar Rs 2,000 hota tha.
  }

  let paymentId: string | undefined;
  let paymentNotice: string | undefined;
  if (makePayment === "yes" && paymentAccountId) {
    let receiptPhotoUrl: string | null = null;
    if (receiptPhoto) {
      const uploaded = await uploadGrainReceipt(serviceClient, receiptPhoto);
      if ("error" in uploaded) return { error: `Entry save ho gayi, magar payment nahi hui: ${uploaded.error}`, entryId: entry.id };
      receiptPhotoUrl = uploaded.url;
    }
    // Payment row, kisan udhaar ki katauti, cash book, wallet aur journal --
    // sab EK transaction mein (migration 516). Kuch bhi fail ho to payment
    // ka koi hissa darj nahi hota.
    const { data: paid, error: payError } = await (supabase as any).rpc("fn_record_grain_procurement_payment_atomic", {
      p: {
        farmer_id: farmerId,
        party_id: partyId,
        amount: paymentAmount,
        payment_method: paymentMethod,
        account_id: paymentAccountId,
        payment_date: entryDate,
        receipt_photo_url: receiptPhotoUrl,
        notes: "Entry ke sath payment hui",
        context: "entry",
        client_action_id: validClientActionId(formData.get("client_action_id")),
        backdate_reason: grainBackdateReason(entryDate, "Grain entry ki payment"),
      },
    });
    if (payError || !paid?.payment_id) {
      return { error: `Entry save ho gayi, magar payment darj nahi hui: ${payError?.message ?? "jawab nahi mila"}`, entryId: entry.id };
    }
    paymentId = paid.payment_id;
    paymentNotice = await grainPostedNotice(supabase, paymentAccountId, paid.entry_number, entryDate, "nikal", Number(paid.credit_deduction ?? 0));
  }

  await notifyRoles(
    ["sales_staff", "manager", "super_admin", "admin", "owner"],
    "Nayi Grain Entry",
    `${grainType} - ${netWeight}kg entry hui hai.`,
    `/admin/grain-procurement`
  );

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/grain-procurement/dashboard");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/finance");
  return { success: true, entryId: entry.id, paymentId, notice: paymentNotice };
}

export async function recordGrainPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const sellerType = String(formData.get("seller_type") ?? "farmer");
  const farmerId = sellerType === "farmer" ? String(formData.get("farmer_id") ?? "") : null;
  const partyId = sellerType === "party" ? String(formData.get("party_id") ?? "") : null;
  const amount = Number(formData.get("amount") ?? 0);
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const accountId = (formData.get("account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const isPartyReceipt = sellerType === "party";

  if (sellerType === "farmer" && !farmerId) return { error: "Farmer select karein." };
  if (sellerType === "party" && !partyId) return { error: "Party select karein." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };
  if (!accountId) return { error: isPartyReceipt ? "Paisa kis account mein receive hua, wo select karein." : "Konsa account se paisa gaya, wo select karein." };

  const paymentDate = grainPaymentDate(formData.get("payment_date"));
  if ("error" in paymentDate) return { error: paymentDate.error };

  let receiptPhotoUrl: string | null = null;
  const receiptPhoto = formData.get("receipt_photo");
  if (paymentMethod === "cash" && !isPartyReceipt) {
    if (!(receiptPhoto instanceof File) || receiptPhoto.size === 0) {
      return { error: "Cash payment ke liye Farmer ki signed Receiving ki photo attach karna zaroori hai." };
    }
  }
  if (receiptPhoto instanceof File && receiptPhoto.size > 0) {
    // Upload pehle -- fail ho to kuch bhi darj nahi hota.
    const uploaded = await uploadGrainReceipt(serviceClient, receiptPhoto);
    if ("error" in uploaded) return { error: uploaded.error };
    receiptPhotoUrl = uploaded.url;
  }

  // Payment row, kisan udhaar ki katauti, cash book (finance_transactions),
  // wallet aur journal (Dr 5020 / Cr bank, ya party receipt par Dr bank /
  // Cr 4010) -- sab EK database transaction mein (migration 516). Pehle ye
  // alag alag qadam the aur farmer payment ka journal banta hi nahi tha.
  const { data: paid, error } = await (supabase as any).rpc("fn_record_grain_procurement_payment_atomic", {
    p: {
      farmer_id: farmerId,
      party_id: partyId,
      is_party_receipt: isPartyReceipt,
      amount,
      payment_method: paymentMethod,
      account_id: accountId,
      payment_date: paymentDate.date,
      receipt_photo_url: receiptPhotoUrl,
      notes,
      context: "payment",
      client_action_id: validClientActionId(formData.get("client_action_id")),
      backdate_reason: String(formData.get("backdate_reason") ?? "").trim() || grainBackdateReason(paymentDate.date, "Grain payment"),
    },
  });
  if (error) return { error: error.message };
  if (!paid?.payment_id) return { error: "Payment ka jawab nahi mila." };

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/grain-procurement/payments");
  revalidatePath("/admin/finance");
  return {
    success: true,
    entryId: paid.payment_id,
    paymentId: paid.payment_id,
    notice: await grainPostedNotice(supabase, accountId, paid.entry_number, paymentDate.date, isPartyReceipt ? "jama" : "nikal",
      Number(paid.credit_deduction ?? 0)),
  };
}

/**
 * An older grain row can be corrected without deleting its audit trail.
 * Purchase remains payable; Sale is copied into the existing grain-sales
 * flow and the original row is marked as reclassified.
 */
export async function editGrainEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const entryId = String(formData.get("entry_id") ?? "").trim();
  const transactionType = String(formData.get("transaction_type") ?? "purchase");
  const buyerId = String(formData.get("buyer_id") ?? "").trim();
  const paymentIds = (() => { try { const value = JSON.parse(String(formData.get("payment_ids") ?? "[]")); return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []; } catch { return []; } })();

  if (!entryId) return { error: "Entry nahi mili." };
  if (transactionType !== "purchase" && transactionType !== "sale") return { error: "Purchase ya Sale select karein." };

  const { data: entry, error: entryError } = await supabase
    .from("grain_procurement_entries")
    .select("id, entry_date, grain_type, warehouse_id, weight_kg, rate_per_kg, total_amount, notes, party_id, farmer_id, reclassified_as_sale_id")
    .eq("id", entryId)
    .maybeSingle();
  if (entryError) return { error: entryError.message };
  if (!entry) return { error: "Grain entry nahi mili." };

  if (transactionType === "purchase") {
    if (entry.reclassified_as_sale_id) return { error: "Ye entry pehle Sale ban chuki hai. Isay Purchase mein wapas lane ke liye Sale reversal required hai." };
    revalidatePath("/admin/grain-procurement");
    return { success: true, notice: "Entry Purchase/Payable ke tor par save hai." };
  }

  if (!buyerId) return { error: "Sale ke liye buyer select karein." };
  if (!entry.warehouse_id) return { error: "Sale banane se pehle entry ka warehouse zaroori hai." };
  if (entry.reclassified_as_sale_id) return { success: true, notice: "Ye entry pehle hi Sale/Receivable ban chuki hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const year = new Date(`${entry.entry_date}T00:00:00`).getFullYear() % 100;
  const { data: counter } = await supabase.from("grain_sale_counters").select("last_number").eq("year", year).maybeSingle();
  const nextNumber = Number(counter?.last_number ?? 0) + 1;
  if (counter) await supabase.from("grain_sale_counters").update({ last_number: nextNumber }).eq("year", year);
  else await supabase.from("grain_sale_counters").insert({ year, last_number: nextNumber });
  const saleNumber = `GRN-SALE-${year}-${String(nextNumber).padStart(5, "0")}`;

  const { data: sale, error: saleError } = await supabase
    .from("grain_sales")
    .insert({
      sale_number: saleNumber,
      buyer_id: buyerId,
      grain_type: entry.grain_type,
      warehouse_id: entry.warehouse_id,
      quantity_kg: Number(entry.weight_kg),
      rate_per_kg: Number(entry.rate_per_kg),
      total_amount: Number(entry.total_amount),
      total_cogs: Number(entry.total_amount),
      profit: 0,
      sale_date: entry.entry_date,
      amount_received: 0,
      notes: `Reclassified from grain purchase entry ${entry.id}. ${entry.notes ?? ""}`.trim(),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (saleError || !sale) return { error: saleError?.message ?? "Sale record nahi ban saka." };

  const { error: markError } = await supabase
    .from("grain_procurement_entries")
    .update({ reclassified_as_sale_id: sale.id })
    .eq("id", entry.id)
    .is("reclassified_as_sale_id", null);
  if (markError) {
    await supabase.from("grain_sales").delete().eq("id", sale.id);
    return { error: `Original entry mark nahi ho saki: ${markError.message}` };
  }

  // Only explicitly selected old receipts are moved. They remain in the
  // source table for audit, but stop counting as procurement cash-out.
  if (paymentIds.length > 0) {
    const { data: oldPayments, error: oldPaymentError } = await supabase
      .from("grain_procurement_payments")
      .select("id, amount, payment_method, notes, farmer_id, party_id, reclassified_as_sale_payment_id")
      .in("id", paymentIds);
    if (oldPaymentError) return { error: oldPaymentError.message };
    const validPayments = (oldPayments ?? []).filter((p: any) => !p.reclassified_as_sale_payment_id && ((entry.party_id && p.party_id === entry.party_id) || (entry.farmer_id && p.farmer_id === entry.farmer_id)));
    let received = 0;
    for (const oldPayment of validPayments) {
      const { data: salePayment, error: salePaymentError } = await supabase.from("grain_sale_payments").insert({
        sale_id: sale.id,
        amount: Number(oldPayment.amount),
        payment_method: oldPayment.payment_method,
        notes: `Reclassified from procurement payment ${oldPayment.id}. ${oldPayment.notes ?? ""}`.trim(),
        created_by: user?.id ?? null,
      }).select("id").single();
      if (salePaymentError || !salePayment) return { error: salePaymentError?.message ?? "Sale receipt link nahi ho saki." };
      await supabase.from("grain_procurement_payments").update({ reclassified_as_sale_payment_id: salePayment.id }).eq("id", oldPayment.id);
      received += Number(oldPayment.amount);
    }
    if (received > 0) await supabase.from("grain_sales").update({ amount_received: received }).eq("id", sale.id);
  }

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/grain-procurement/sell");
  revalidatePath("/admin/grain-procurement/dashboard");
  revalidatePath("/admin/finance");
  return { success: true, notice: "Entry Sale/Receivable mein convert ho gayi." };
}

export async function editGrainPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const paymentId = String(formData.get("payment_id") ?? "");
  const newAmount = Number(formData.get("amount") ?? 0);
  const newMethod = (formData.get("payment_method") as string) || null;
  const newAccountId = (formData.get("account_id") as string) || null;
  const newNotes = (formData.get("notes") as string) || null;

  if (!paymentId) return { error: "Missing payment id." };
  if (!newAmount || newAmount <= 0) return { error: "Amount sahi likhein." };
  if (!newAccountId) return { error: "Account select karein." };

  const { data: payment } = await supabase.from("grain_procurement_payments").select("amount, payment_method, original_amount").eq("id", paymentId).single();
  if (!payment) return { error: "Payment nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("grain_procurement_payments")
    .update({
      amount: newAmount,
      payment_method: newMethod,
      notes: newNotes,
      is_edited: true,
      original_amount: payment.original_amount ?? payment.amount,
      edited_by: user?.id ?? null,
      edited_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  await supabase.from("finance_transactions").insert({
    account_id: newAccountId,
    transaction_type: "expense",
    category: "Grain Procurement Payment (Edited)",
    amount: newAmount - Number(payment.amount),
    transaction_date: aajKaKhana(),
    notes: `Payment edit hui: purana Rs ${payment.amount} -> naya Rs ${newAmount}`,
    created_by: user?.id ?? null,
  });

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function createGrainParty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const partyName = String(formData.get("party_name") ?? "").trim();
  const contactPerson = (formData.get("contact_person") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const cnic = (formData.get("cnic") as string) || null;
  const address = (formData.get("address") as string) || null;
  if (!partyName) return { error: "Party ka naam likhein." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("grain_parties").insert({
    party_name: partyName,
    contact_person: contactPerson,
    phone,
    cnic,
    address,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/grain-procurement");
  return { success: true };
}

export async function updateGrainPackRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login required." };
  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !["owner","super_admin","admin"].includes(profile.role ?? "")) return { error: "Sirf Owner/Admin grain rules edit kar sakta hai." };
  const grainType = String(formData.get("grain_type") ?? "");
  const isBagBased = String(formData.get("is_bag_based") ?? "") === "yes";
  const bagWeightKg = isBagBased ? Number(formData.get("bag_weight_kg") ?? 0) : null;
  const defaultCutKg = Number(formData.get("default_cut_kg") ?? 0);
  const defaultCutGrams = Number(formData.get("default_cut_grams") ?? 0);
  const defaultChungiKg = Number(formData.get("default_chungi_kg") ?? 0);
  if (!["wheat","rice","maize"].includes(grainType)) return { error: "Grain type sahi nahi." };
  if (isBagBased && (!Number.isFinite(bagWeightKg) || !bagWeightKg || bagWeightKg <= 0 || bagWeightKg > 1000)) return { error: "Bori ka weight 0 se zyada aur 1000kg tak likhein." };
  if (![defaultCutKg,defaultCutGrams,defaultChungiKg].every(Number.isFinite) || defaultCutKg < 0 || defaultCutGrams < 0 || defaultCutGrams > 999 || defaultChungiKg < 0) return { error: "Cut aur chungi values sahi likhein; gram 0-999 hon." };
  const { error } = await (supabase as any).from("grain_pack_rules").upsert({
    grain_type: grainType, is_bag_based: isBagBased, bag_weight_kg: bagWeightKg,
    default_cut_kg: defaultCutKg, default_cut_grams: defaultCutGrams,
    default_chungi_kg: defaultChungiKg, updated_at: new Date().toISOString(), updated_by: user.id,
  }, { onConflict: "grain_type" });
  if (error) return { error: error.message };
  revalidatePath("/admin/grain-procurement");
  return { success: true, notice: "Grain rule save ho gaya. Nayi entries par apply hoga; purane records nahi badlenge." };
}

export async function createCutPreset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (!["super_admin", "admin", "owner"].includes(profile?.role ?? "")) return { error: "Sirf Admin preset bana sakta hai." };

  const grainType = String(formData.get("grain_type") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const cutPercentage = Number(formData.get("cut_percentage") ?? 0);
  if (!["wheat", "rice", "maize"].includes(grainType)) return { error: "Grain type sahi select karein." };
  if (!label) return { error: "Label likhein." };
  if (cutPercentage < 0 || cutPercentage > 100) return { error: "Cut percentage 0-100 ke darmiyan hona chahiye." };

  const { error } = await supabase.from("grain_cut_presets").insert({ grain_type: grainType, label, cut_percentage: cutPercentage });
  if (error) return { error: error.message };
  revalidatePath("/admin/grain-procurement/cut-presets");
  return { success: true };
}

export async function updateCutPreset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (!["super_admin", "admin", "owner"].includes(profile?.role ?? "")) return { error: "Sirf Admin edit kar sakta hai." };

  const presetId = String(formData.get("preset_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const cutPercentage = Number(formData.get("cut_percentage") ?? 0);
  if (!presetId) return { error: "Missing preset id." };
  if (!label) return { error: "Label likhein." };
  if (cutPercentage < 0 || cutPercentage > 100) return { error: "Cut percentage 0-100 ke darmiyan hona chahiye." };

  const { error } = await supabase.from("grain_cut_presets").update({ label, cut_percentage: cutPercentage }).eq("id", presetId);
  if (error) return { error: error.message };
  revalidatePath("/admin/grain-procurement/cut-presets");
  return { success: true };
}

export async function deleteCutPreset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  if (!["super_admin", "admin", "owner"].includes(profile?.role ?? "")) return { error: "Sirf Admin delete kar sakta hai." };

  const presetId = String(formData.get("preset_id") ?? "");
  const { error } = await supabase.from("grain_cut_presets").update({ is_active: false }).eq("id", presetId);
  if (error) return { error: error.message };
  revalidatePath("/admin/grain-procurement/cut-presets");
  return { success: true };
}

export async function emailGrainPaymentSlip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const paymentId = String(formData.get("payment_id") ?? "");
  const toEmail = String(formData.get("to_email") ?? "").trim();
  if (!paymentId) return { error: "Missing payment id." };
  if (!toEmail) return { error: "Email likhein." };

  const { data: payment } = await supabase
    .from("grain_procurement_payments")
    .select("amount, payment_method, notes, created_at, farmer_id, party_id, farmers(full_name, phone_number), grain_parties(party_name, phone)")
    .eq("id", paymentId)
    .single();
  if (!payment) return { error: "Payment nahi mili." };

  const farmer = Array.isArray((payment as any).farmers) ? (payment as any).farmers[0] : (payment as any).farmers;
  const party = Array.isArray((payment as any).grain_parties) ? (payment as any).grain_parties[0] : (payment as any).grain_parties;
  const sellerName = farmer?.full_name ?? party?.party_name ?? "-";
  const sellerPhone = farmer?.phone_number ?? party?.phone ?? null;

  const { generateGrainPaymentSlipPdf } = await import("@/lib/grain-payment-slip-pdf");
  const pdfBuffer = await generateGrainPaymentSlipPdf({
    slipNumber: `SLIP-${paymentId.slice(0, 8).toUpperCase()}`,
    sellerName,
    sellerType: payment.farmer_id ? "Farmer" : "Party",
    sellerPhone,
    amount: Number(payment.amount),
    paymentMethod: payment.payment_method,
    notes: payment.notes,
    date: new Date(payment.created_at).toLocaleDateString(),
  });

  // Anaj ki slip anaj ke khate se (`src/lib/mailer.ts`).
  const sent = await sendDeptMail({
    dept: "grain",
    to: toEmail,
    subject: `Payment Slip - ${sellerName}`,
    html: mailWrapper(
      `<p>Assalam-o-Alaikum ${sellerName},</p><p>Aapki grain payment ki slip is email ke sath attach hai.</p><p><strong>Amount:</strong> Rs ${Number(payment.amount).toLocaleString()}</p>`,
      "grain"
    ),
    attachments: [{ filename: `payment-slip-${paymentId.slice(0, 8)}.pdf`, content: pdfBuffer }],
  });
  if (!sent.sent) return { error: sent.error };
  return { success: true, notice: `Slip ${toEmail} par bhej di gayi (${sent.from} se).` };
}
