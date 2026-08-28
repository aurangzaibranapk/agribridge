"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postCashOut, postWalletMovement, ACC } from "@/lib/ledger/rules";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  success?: boolean;
  entryId?: string;
  paymentId?: string;
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

export async function createGrainEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const sellerType = String(formData.get("seller_type") ?? "farmer");
  const farmerId = sellerType === "farmer" ? String(formData.get("farmer_id") ?? "") : null;
  const partyId = sellerType === "party" ? String(formData.get("party_id") ?? "") : null;
  const grainType = String(formData.get("grain_type") ?? "");
  const entryDate = String(formData.get("entry_date") ?? new Date().toISOString().slice(0, 10));
  const grossWeight = Number(formData.get("gross_weight_kg") ?? 0);
  const cutPercentage = Number(formData.get("cut_percentage") ?? 0);
  const rate = Number(formData.get("rate_per_kg") ?? 0);
  const chungiType = String(formData.get("chungi_type") ?? "cash");
  const chungiKg = Number(formData.get("chungi_kg") ?? 0);
  const chungiAmountInput = Number(formData.get("chungi_amount") ?? 0);
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

  if (sellerType === "farmer" && !farmerId) return { error: "Farmer select karein." };
  if (sellerType === "party" && !partyId) return { error: "Party select karein." };
  if (!["wheat", "rice", "maize"].includes(grainType)) return { error: "Invalid grain type." };
  if (!grossWeight || grossWeight <= 0) return { error: "Gross weight must be greater than zero." };
  if (cutPercentage < 0 || cutPercentage > 100) return { error: "Cut percentage sahi likhein (0-100)." };
  if (!rate || rate <= 0) return { error: "Rate must be greater than zero." };
  if (!warehouseId) return { error: "Warehouse select karein (stock yahan add hoga)." };
  if (!["cash", "grain"].includes(chungiType)) return { error: "Chungi type sahi select karein." };

  const cutKg = grossWeight * (cutPercentage / 100);
  const netWeight = grossWeight - cutKg;
  const totalAmount = netWeight * rate;
  const chungiAmount = chungiType === "grain" ? chungiKg * rate : chungiAmountInput;
  if (chungiAmount < 0) return { error: "Chungi amount sahi likhein." };
  if (chungiAmount > totalAmount) return { error: "Chungi amount total value se zyada nahi ho sakta." };
  const payableToSeller = totalAmount - chungiAmount;

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

  const { data: entry, error } = await supabase
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
    let inventoryId: string;
    let balanceAfter: number;
    if (existingInv) {
      inventoryId = existingInv.id;
      balanceAfter = Number(existingInv.quantity_on_hand) + netWeight;
      await supabase.from("inventory").update({ quantity_on_hand: balanceAfter, updated_at: new Date().toISOString() }).eq("id", inventoryId);
    } else {
      balanceAfter = netWeight;
      const { data: newInv } = await supabase
        .from("inventory")
        .insert({ warehouse_id: warehouseId, product_id: productId, quantity_on_hand: netWeight })
        .select("id")
        .single();
      inventoryId = newInv?.id ?? "";
    }
    if (inventoryId) {
      await supabase.from("stock_movements").insert({
        inventory_id: inventoryId,
        movement_type: "grain_procurement_in",
        quantity: netWeight,
        balance_after: balanceAfter,
        reference_type: "grain_procurement",
        reference_id: entry.id,
        created_by: user?.id ?? null,
      });
    }
    await supabase.from("stock_batches").insert({
      product_id: productId,
      warehouse_id: warehouseId,
      batch_number: `GRAIN-${entry.id.slice(0, 8)}`,
      initial_quantity: netWeight,
      remaining_quantity: netWeight,
      unit_cost: rate,
    });
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
          claims: [{ table: "finance_transactions", rowId: opExpRow.id }],
        },
      });
    }
    const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", exp.account_id).single();
    if (account) {
      await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - exp.amount }).eq("id", exp.account_id);
    }
  }

  let paymentId: string | undefined;
  if (makePayment === "yes" && paymentAccountId) {
    let receiptPhotoUrl: string | null = null;
    if (receiptPhoto) {
      const path = `${Date.now()}-${receiptPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await serviceClient.storage.from("grain-payment-receipts").upload(path, receiptPhoto);
      if (!uploadError) {
        const { data } = serviceClient.storage.from("grain-payment-receipts").getPublicUrl(path);
        receiptPhotoUrl = data.publicUrl;
      }
    }

    let creditDeduction = 0;
    if (farmerId) {
      const { data: creditRows } = await supabase.from("farmer_credit_ledger").select("ledger_type, amount").eq("farmer_id", farmerId);
      const outstandingCredit = (creditRows ?? []).reduce((sum, r) => {
        return r.ledger_type === "debit" ? sum + Number(r.amount) : sum - Number(r.amount);
      }, 0);
      creditDeduction = Math.min(Math.max(outstandingCredit, 0), paymentAmount);
    }
    const actualCashOut = paymentAmount - creditDeduction;

    const { data: payment } = await supabase
      .from("grain_procurement_payments")
      .insert({
        farmer_id: farmerId,
        party_id: partyId,
        amount: paymentAmount,
        payment_method: paymentMethod,
        receipt_photo_url: receiptPhotoUrl,
        notes: `Entry ke sath payment hui${creditDeduction > 0 ? ` (Rs ${creditDeduction.toLocaleString()} pehle ke credit se kaata gaya)` : ""}`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    paymentId = payment?.id;

    if (creditDeduction > 0 && farmerId) {
      const { data: lastRow } = await supabase
        .from("farmer_credit_ledger")
        .select("balance_after")
        .eq("farmer_id", farmerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const prevBalance = Number(lastRow?.balance_after ?? 0);
      await supabase.from("farmer_credit_ledger").insert({
        farmer_id: farmerId,
        source_type: "grain_procurement",
        ledger_type: "credit",
        amount: creditDeduction,
        balance_after: prevBalance - creditDeduction,
        notes: "Grain payment se automatically kaata gaya",
        created_by: user?.id ?? null,
      });
    }

    if (actualCashOut > 0) {
      await supabase.from("finance_transactions").insert({
        account_id: paymentAccountId,
        transaction_type: "expense",
        category: "Grain Procurement Payment",
        amount: actualCashOut,
        transaction_date: entryDate,
        notes: `Grain payment (${paymentMethod ?? "cash"}) - Entry ke sath`,
        created_by: user?.id ?? null,
      });
      const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", paymentAccountId).single();
      if (account) {
        await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - actualCashOut }).eq("id", paymentAccountId);
      }
      if (farmerId) {
        const { data: payWallet } = await supabase.from("wallets").select("id").eq("owner_type", "farmer").eq("owner_id", farmerId).single();
        if (payWallet) {
          await supabase.from("wallet_transactions").insert({
            wallet_id: payWallet.id,
            type: "grain_cash_payment",
            direction: "debit",
            amount: actualCashOut,
            balance_after: 0,
            reference_type: "grain_procurement_payment",
            reference_id: paymentId,
            notes: `Grain cash payment (${paymentMethod ?? "cash"})`,
            created_by: user?.id ?? null,
          });
        }
      }
    }
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
  return { success: true, entryId: entry.id, paymentId };
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

  if (sellerType === "farmer" && !farmerId) return { error: "Farmer select karein." };
  if (sellerType === "party" && !partyId) return { error: "Party select karein." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };
  if (!accountId) return { error: "Konsa account se paisa gaya, wo select karein." };

  let receiptPhotoUrl: string | null = null;
  const receiptPhoto = formData.get("receipt_photo");
  if (paymentMethod === "cash") {
    if (!(receiptPhoto instanceof File) || receiptPhoto.size === 0) {
      return { error: "Cash payment ke liye Farmer ki signed Receiving ki photo attach karna zaroori hai." };
    }
  }
  if (receiptPhoto instanceof File && receiptPhoto.size > 0) {
    const path = `${Date.now()}-${receiptPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await serviceClient.storage.from("grain-payment-receipts").upload(path, receiptPhoto);
    if (!uploadError) {
      const { data } = serviceClient.storage.from("grain-payment-receipts").getPublicUrl(path);
      receiptPhotoUrl = data.publicUrl;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let creditDeduction = 0;
  if (farmerId) {
    const { data: creditRows } = await supabase.from("farmer_credit_ledger").select("ledger_type, amount").eq("farmer_id", farmerId);
    const outstandingCredit = (creditRows ?? []).reduce((sum, r) => {
      return r.ledger_type === "debit" ? sum + Number(r.amount) : sum - Number(r.amount);
    }, 0);
    creditDeduction = Math.min(Math.max(outstandingCredit, 0), amount);
  }
  const actualCashOut = amount - creditDeduction;

  const { data: payment, error } = await supabase
    .from("grain_procurement_payments")
    .insert({
      farmer_id: farmerId,
      party_id: partyId,
      amount,
      payment_method: paymentMethod,
      receipt_photo_url: receiptPhotoUrl,
      notes: creditDeduction > 0 ? `${notes ?? ""} (Rs ${creditDeduction.toLocaleString()} pehle ke credit se kaata gaya)`.trim() : notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (creditDeduction > 0 && farmerId) {
    const { data: lastRow } = await supabase
      .from("farmer_credit_ledger")
      .select("balance_after")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevBalance = Number(lastRow?.balance_after ?? 0);
    await supabase.from("farmer_credit_ledger").insert({
      farmer_id: farmerId,
      source_type: "grain_procurement",
      ledger_type: "credit",
      amount: creditDeduction,
      balance_after: prevBalance - creditDeduction,
      notes: "Grain payment se automatically kaata gaya",
      created_by: user?.id ?? null,
    });
  }

  if (actualCashOut > 0) {
    await supabase.from("finance_transactions").insert({
      account_id: accountId,
      transaction_type: "expense",
      category: "Grain Procurement Payment",
      amount: actualCashOut,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `Grain payment (${paymentMethod ?? "cash"})`,
      created_by: user?.id ?? null,
    });
    const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
    if (account) {
      await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - actualCashOut }).eq("id", accountId);
    }
    if (farmerId) {
      const { data: payWallet } = await supabase.from("wallets").select("id").eq("owner_type", "farmer").eq("owner_id", farmerId).single();
      if (payWallet) {
        await supabase.from("wallet_transactions").insert({
          wallet_id: payWallet.id,
          type: "grain_cash_payment",
          direction: "debit",
          amount: actualCashOut,
          balance_after: 0,
          reference_type: "grain_procurement_payment",
          reference_id: payment?.id,
          notes: `Grain cash payment (${paymentMethod ?? "cash"})`,
          created_by: user?.id ?? null,
        });
      }
    }
  }

  revalidatePath("/admin/grain-procurement");
  revalidatePath("/admin/finance");
  return { success: true, entryId: payment?.id, paymentId: payment?.id };
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
    transaction_date: new Date().toISOString().slice(0, 10),
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

  const nodemailer = (await import("nodemailer")).default;
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "mail.alranatraders.pk",
      port: 587,
      secure: false,
      auth: { user: process.env.JOB_SMTP_USER ?? "job@alranatraders.pk", pass: process.env.JOB_SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Al Rana Traders" <${process.env.JOB_SMTP_USER ?? "job@alranatraders.pk"}>`,
      to: toEmail,
      subject: `Payment Slip - ${sellerName}`,
      html: `<p>Assalam-o-Alaikum ${sellerName},</p><p>Aapki grain payment ki slip is email ke sath attach hai.</p><p>Amount: Rs ${Number(payment.amount).toLocaleString()}</p><p>Al Rana Traders - AgriBridge</p>`,
      attachments: [{ filename: `payment-slip-${paymentId.slice(0, 8)}.pdf`, content: pdfBuffer }],
    });
  } catch {
    return { error: "Email bhejne mein masla hua." };
  }
  return { success: true };
}