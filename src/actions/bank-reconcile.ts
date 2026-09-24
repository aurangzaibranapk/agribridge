"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC, expenseAccountFor, incomeAccountFor } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Bank statement ki qataren daalna.
 *
 * Format jaan boojh kar sada rakha hai -- har line: tareekh, tafseel,
 * raqam. Banks ka koi ek CSV format nahi hota, aur har bank ke liye
 * alag parser likhna wo kaam hai jo kabhi khatam nahi hota. Copy-paste
 * har bank ke sath chalta hai.
 *
 * Musbat raqam = bank mein aaya, manfi = bank se gaya.
 */
export async function importBankLines(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const accountId = String(formData.get("account_id") ?? "");
  const raw = String(formData.get("lines") ?? "").trim();

  if (!accountId) return { error: "Bank account select karein." };
  if (!raw) return { error: "Statement ki qataren paste karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows: { txn_date: string; description: string; amount: number }[] = [];
  const bad: string[] = [];

  for (const line of raw.split("\n")) {
    const text = line.trim();
    if (!text) continue;

    // Tab ya comma -- dono chalte hain, kyunki Excel se copy karne par
    // tab aata hai aur CSV se comma.
    const parts = text.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) {
      bad.push(text);
      continue;
    }

    const [dateRaw, ...rest] = parts;
    const amountRaw = rest[rest.length - 1];
    const description = rest.slice(0, -1).join(" ").trim();

    const date = new Date(dateRaw);
    const amount = Number(amountRaw.replace(/[Rs,\s]/gi, ""));

    if (Number.isNaN(date.getTime()) || !Number.isFinite(amount) || amount === 0 || !description) {
      bad.push(text);
      continue;
    }

    rows.push({
      txn_date: date.toISOString().slice(0, 10),
      description,
      amount,
    });
  }

  if (rows.length === 0) {
    return {
      error: `Koi qatar samajh nahi aayi. Har line aisi honi chahiye: 2026-08-25, UBL cheque 1234, -50000`,
    };
  }

  // Dobara import hone par purani qataren chup chaap chhor di jati hain
  // (unique index un ko rok deta hai). Bank statement dobara upload
  // karna aam baat hai, aur dobara import hone se bank ka balance dugna
  // nazar aata hai -- wo ghalti khud ko theek dikhati hai.
  const { data: inserted, error } = await service
    .from("bank_statement_lines")
    .upsert(
      rows.map((r) => ({ ...r, account_id: accountId, imported_by: user?.id ?? null })),
      { onConflict: "account_id,txn_date,amount,desc_hash", ignoreDuplicates: true }
    )
    .select("id");

  if (error) return { error: error.message };

  const added = inserted?.length ?? 0;
  const skipped = rows.length - added;

  revalidatePath("/admin/bank-reconcile");
  return {
    success: true,
    message:
      `${added} qatar daali gayi.` +
      (skipped > 0 ? ` ${skipped} pehle se maujood thin, dobara nahi daali gayin.` : "") +
      (bad.length > 0 ? ` ${bad.length} line samajh nahi aayi — un ko dekh lein.` : ""),
  };
}

/**
 * Bank ki wo qatar jo hamare khate mein hai hi nahi -- us ki entry
 * banana.
 *
 * Bank charges, munafa, ya koi aisi adaigi jo kisi ne likhi hi nahi --
 * ye har mahine nikalti hain. In ko "chhota sa hai" keh kar chhor dena
 * hi wo tareeqa hai jis se bank aur khata dheere dheere alag hote chale
 * jate hain, aur ek din farq itna bara ho jata hai ke koi us ki wajah
 * nahi dhoondh sakta.
 */
export async function bookBankLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const lineId = String(formData.get("line_id") ?? "");
  const category = String(formData.get("category") ?? "").trim();

  if (!lineId) return { error: "Qatar select karein." };
  if (!category) return { error: "Ye kis qism ka hai, wo likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: line } = await service
    .from("bank_statement_lines")
    .select("id, txn_date, description, amount, status")
    .eq("id", lineId)
    .maybeSingle();

  if (!line) return { error: "Qatar nahi mili." };
  if (line.status === "matched") return { error: "Ye qatar pehle hi mil chuki hai." };

  const amount = Math.abs(Number(line.amount));
  const moneyIn = Number(line.amount) > 0;

  const posted = await postJournal({
    description: `Bank: ${line.description}`,
    sourceModule: "bank_reconcile",
    sourceId: line.id,
    entryDate: line.txn_date,
    createdBy: user?.id ?? null,
    backdateReason: "Bank statement se mili hui qatar — bank ki tareekh hi asal tareekh hai.",
    lines: moneyIn
      ? [
          { account: ACC.bank, debit: amount, memo: line.description },
          { account: incomeAccountFor(category), credit: amount, memo: category },
        ]
      : [
          { account: expenseAccountFor(category), debit: amount, memo: category },
          { account: ACC.bank, credit: amount, memo: line.description },
        ],
  });

  if ("error" in posted) return { error: `Entry nahi ban saki: ${posted.error}` };

  const { error } = await service
    .from("bank_statement_lines")
    .update({
      status: "matched",
      matched_entry_id: posted.id,
      matched_at: new Date().toISOString(),
      matched_by: user?.id ?? null,
    })
    .eq("id", lineId);

  if (error) return { error: error.message };

  revalidatePath("/admin/bank-reconcile");
  revalidatePath("/admin/money-trail");
  return { success: true, message: `Rs ${amount.toLocaleString()} ki entry ban gayi aur qatar mil gayi.` };
}
