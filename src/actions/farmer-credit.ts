"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/types/database.types";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { postFarmerCreditGiven, postFarmerCreditRepaid, glForFinanceAccount, failed } from "@/lib/ledger/rules";
import { farmerCreditNeedsOverride } from "@/lib/money/review-guards";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

const CREDIT_OVERRIDE_ROLES = ["owner", "super_admin", "admin", "manager"];

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
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!sourceType) return { error: "Source type select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };

  const { data: farmer } = await supabase.from("farmers").select("credit_limit").eq("id", farmerId).maybeSingle();
  const currentBalance = await getBalanceDue(supabase, farmerId);
  const needsOverride = farmerCreditNeedsOverride(
    farmer?.credit_limit == null ? null : Number(farmer.credit_limit),
    currentBalance,
    amount,
  );
  if (needsOverride && !overrideLimit) {
    const hadd = Number(farmer?.credit_limit ?? 0);
    return {
      error: hadd > 0
        ? `LIMIT_EXCEEDED:Is Farmer ki Credit Limit Rs ${hadd.toLocaleString()} hai. Naye balance ke sath Rs ${(currentBalance + amount).toLocaleString()} ho jayega.`
        : "LIMIT_EXCEEDED:Is Farmer ki credit limit set nahi. Manager ya Admin override ke baghair udhaar nahi nikalta.",
    };
  }
  if (needsOverride && overrideLimit) {
    const {
      data: { user: actor },
    } = await supabase.auth.getUser();
    const { data: me } = actor
      ? await supabase.from("profiles").select("role, is_active").eq("id", actor.id).maybeSingle()
      : { data: null };
    if (!me?.is_active || !CREDIT_OVERRIDE_ROLES.includes(String(me.role))) {
      return { error: "Credit limit override sirf Manager ya Admin de sakta hai." };
    }
  }

  if (clientActionId) {
    const { data, error } = await (supabase as any).rpc("fn_post_farmer_credit_atomic", {
      p_mode: "issue", p_farmer_id: farmerId, p_amount: amount, p_source_type: sourceType,
      p_notes: notes, p_collected_by: collectedBy, p_client_action_id: clientActionId,
      p_override: needsOverride && overrideLimit,
    });
    if (error) return { error: error.message };
    if (data?.success) return { success: true };
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
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

  if (!farmerId) return { error: "Farmer select karein." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Konsa account mein paisa aya, wo select karein." };

  if (clientActionId) {
    const { data, error } = await (supabase as any).rpc("fn_post_farmer_credit_atomic", {
      p_mode: "repayment", p_farmer_id: farmerId, p_amount: amount, p_account_id: accountId,
      p_notes: notes, p_client_action_id: clientActionId,
    });
    if (error) return { error: error.message };
    if (data?.success) return { success: true };
  }

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

  const service = createServiceClient();
  const { data: cashRow, error: cashErr } = await service
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: "income",
      category: "Farmer Credit Repayment",
      amount,
      transaction_date: aajKaKhana(),
      notes: `Farmer credit repayment${notes ? ` - ${notes}` : ""}`,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (cashErr || !cashRow?.id) return { error: `Cash Book mein wapsi nahi gayi: ${cashErr?.message ?? "jawab nahi"}` };

  // Balance yahan se NAHI hilaya jata. finance_transactions mein qatar
  // daalte hi trigger khud hila deta hai (023, aur 127 se ab mitane aur
  // badalne par bhi). Pehle yahan dobara bhi hilaya jata tha, yani Rs
  // 1,000 ka asar Rs 2,000 hota tha.

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !UNRESTRICTED_ROLES.includes(String(me.role))) {
    return { error: "Credit limit sirf Admin ya Owner badal sakta hai." };
  }
  const farmerId = String(formData.get("farmer_id") ?? "");
  const limit = formData.get("credit_limit") ? Number(formData.get("credit_limit")) : null;
  if (!farmerId) return { error: "Farmer select karein." };

  const { error } = await supabase.from("farmers").update({ credit_limit: limit }).eq("id", farmerId);
  if (error) return { error: error.message };
  revalidatePath("/admin/farmer-credit");
  return { success: true };
}
