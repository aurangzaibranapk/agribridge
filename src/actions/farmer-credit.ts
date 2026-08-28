"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { postFarmerCreditGiven, postFarmerCreditRepaid, glForFinanceAccount, failed } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function getBalanceDue(supabase: ReturnType<typeof createClient>, farmerId: string): Promise<number> {
  const { data: rows } = await supabase.from("farmer_credit_ledger").select("ledger_type, amount").eq("farmer_id", farmerId);
  return (rows ?? []).reduce((sum, r) => (r.ledger_type === "debit" ? sum + Number(r.amount) : sum - Number(r.amount)), 0);
}

export async function issueFarmerCredit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const sourceType = String(
    formData.get("source_type") ?? ""
  ) as Database["public"]["Enums"]["credit_source_type"];
  const amount = Number(formData.get("amount") ?? 0);
  const collectedBy = (formData.get("collected_by") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const overrideLimit = formData.get("override_limit") === "true";

  if (!farmerId) return { error: "Farmer select karein." };
  if (!sourceType) return { error: "Source type select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const { data: farmer } = await supabase.from("farmers").select("credit_limit").eq("id", farmerId).maybeSingle();
  if (farmer?.credit_limit) {
    const currentBalance = await getBalanceDue(supabase, farmerId);
    const newBalance = currentBalance + amount;
    if (newBalance > Number(farmer.credit_limit) && !overrideLimit) {
      return { error: `LIMIT_EXCEEDED:Is Farmer ki Credit Limit Rs ${Number(farmer.credit_limit).toLocaleString()} hai. Naye balance ke sath Rs ${newBalance.toLocaleString()} ho jayega.` };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // balance_after database mein lazmi hai magar us ka koi default nahi.
  // Seedha insert karne par entry chup chaap nakaam ho jati thi -- is
  // liye ab har raasta postFarmerLedger se guzarta hai.
  const ledger = await postFarmerLedger({
    farmerId,
    sourceType,
    ledgerType: "debit",
    amount,
    notes: notes ?? "Udhaar diya gaya",
    collectedBy,
    createdBy: user?.id ?? null,
  });
  if (ledger.error) return { error: ledger.error };

  const posted = await postFarmerCreditGiven({
    farmerId,
    amount,
    sourceType,
    description: notes?.trim() || `Kisan ko ${sourceType} udhaar — Rs ${amount.toLocaleString()}`,
    ctx: {
      createdBy: user?.id ?? null,
      claims: ledger.id ? [{ table: "farmer_credit_ledger", rowId: ledger.id }] : [],
    },
  });
  if (failed(posted)) return { error: `Udhaar darj hua magar ledger mein nahi gaya: ${posted.error}` };

  revalidatePath("/admin/farmer-credit");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

export async function recordFarmerCreditRepayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Konsa account mein paisa aya, wo select karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ledger = await postFarmerLedger({
    farmerId,
    sourceType: "other",
    ledgerType: "credit",
    amount,
    notes: notes ? `Manual Repayment: ${notes}` : "Manual Repayment",
    createdBy: user?.id ?? null,
  });
  if (ledger.error) return { error: ledger.error };

  const { data: cashRow } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: "income",
      category: "Farmer Credit Repayment",
      amount,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `Farmer credit repayment${notes ? ` - ${notes}` : ""}`,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  if (account) {
    await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) + amount }).eq("id", accountId);
  }

  // Kisan ne paisa wapas kiya -- ye EK waqia hai jo DO tables mein likha
  // gaya: us ka bojh ghata, aur cash aaya. Is liye entry bhi EK hai jo
  // dono rows ka daawa karti hai. Do alag entries banayein to wahi
  // Rs 5,000 do dafa gin liye jayenge, aur kitab phir bhi barabar
  // rahegi -- yani ghalti khud nahi pakri jayegi.
  const claims = [] as Array<{ table: string; rowId: string }>;
  if (ledger.id) claims.push({ table: "farmer_credit_ledger", rowId: ledger.id });
  if (cashRow?.id) claims.push({ table: "finance_transactions", rowId: cashRow.id });

  const posted = await postFarmerCreditRepaid({
    farmerId,
    amount,
    settledBy: await glForFinanceAccount(accountId),
    description: `Kisan se wapsi — Rs ${amount.toLocaleString()}${notes ? ` (${notes})` : ""}`,
    ctx: { createdBy: user?.id ?? null, claims },
  });
  if (failed(posted)) return { error: `Wapsi darj hui magar ledger mein nahi gayi: ${posted.error}` };

  revalidatePath("/admin/farmer-credit");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

export async function migrateOpeningBalance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const notes = (formData.get("notes") as string) || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!amount || amount === 0) return { error: "Amount sahi likhein." };

  const { data: existing } = await supabase.from("farmer_credit_ledger").select("id").eq("farmer_id", farmerId).eq("source_type", "opening_balance").maybeSingle();
  if (existing) return { error: "Is Farmer ka Opening Balance pehle hi migrate ho chuka hai." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ledger = await postFarmerLedger({
    farmerId,
    sourceType: "opening_balance",
    ledgerType: amount > 0 ? "debit" : "credit",
    amount: Math.abs(amount),
    notes: `DigiKhata se migrate hui (Opening Balance)${notes ? ` - ${notes}` : ""}`,
    createdBy: user?.id ?? null,
  });
  if (ledger.error) return { error: ledger.error };

  // Purana balance aaj ki kamai nahi hai -- wo pehle se maujood tha. Is
  // liye doosri taraf equity hai, aamdani nahi. Aamdani mein daal dein to
  // migration wale mahine ka nafa asal se kahin zyada dikhega.
  const claims = ledger.id ? [{ table: "farmer_credit_ledger", rowId: ledger.id }] : [];
  const posted =
    amount > 0
      ? await postFarmerCreditGiven({
          farmerId,
          amount: Math.abs(amount),
          sourceType: "opening_balance",
          description: `Opening balance — kisan se lena Rs ${Math.abs(amount).toLocaleString()}`,
          ctx: { createdBy: user?.id ?? null, claims },
        })
      : await postFarmerCreditRepaid({
          farmerId,
          amount: Math.abs(amount),
          settledBy: "3200",
          description: `Opening balance — kisan ko dena Rs ${Math.abs(amount).toLocaleString()}`,
          ctx: { createdBy: user?.id ?? null, claims },
        });
  if (failed(posted)) return { error: `Opening balance darj hua magar ledger mein nahi gaya: ${posted.error}` };

  revalidatePath("/admin/farmer-credit");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

export async function setFarmerCreditLimit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const farmerId = String(formData.get("farmer_id") ?? "");
  const limit = formData.get("credit_limit") ? Number(formData.get("credit_limit")) : null;
  if (!farmerId) return { error: "Farmer select karein." };

  const { error } = await supabase.from("farmers").update({ credit_limit: limit }).eq("id", farmerId);
  if (error) return { error: error.message };
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}