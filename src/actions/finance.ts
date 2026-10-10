"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireMoneyAdmin } from "@/lib/access/money-gate";
import { postCashIn, postCashOut, postTransferIn, postTransferOut, failed, ACC, expenseAccountFor, incomeAccountFor } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createFinanceAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Naya khata banana");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  // Enum hai, khula text nahi -- ghalat lafz yahin ruk jaye, database
  // par ja kar na tootay.
  const rawType = String(formData.get("account_type") ?? "cash");
  const accountType = (["cash", "bank", "mobile_wallet", "other"] as const).includes(rawType as never)
    ? (rawType as "cash" | "bank" | "mobile_wallet" | "other")
    : "cash";
  const openingBalance = Number(formData.get("opening_balance") ?? 0);

  if (!name) return { error: "Account name is required." };

  // Khate ki poori pehchaan (314). Ek hi bank mein do khate hon to
  // sirf "UBL" likha dekh kar koi nahi bata sakta ke ye kaun sa hai --
  // aur bank ki statement se milan sirf title aur number se hota hai.
  //
  // Teenon KHALI reh sakte hain (cash box ka koi bank nahi hota), magar
  // khali ko khali hi rehna chahiye. Us jagah kuch bana kar likh dena
  // is project mein pehle bhi ghalat adad de chuka hai.
  const khali = (v: FormDataEntryValue | null) => {
    const x = String(v ?? "").trim();
    return x.length > 0 ? x : null;
  };

  const { data: account, error } = await supabase
    .from("finance_accounts")
    .insert({
      name,
      account_type: accountType,
      bank_name: khali(formData.get("bank_name")),
      account_title: khali(formData.get("account_title")),
      account_number: khali(formData.get("account_number")),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Shuruati raqam ab `opening_balance` ke khane mein CHUP CHAAP nahi
  // baithti. Wo khana sirf Cash Book ka balance badalta tha, ledger ko
  // us ki khabar hi nahi hoti thi -- aur wohi wajah hai ke aaj Cash Book
  // par "Rs -22,650" likha aa raha hai (malik ne 5 September ko poocha
  // "ye minus kahan se aaya"). Khate bane, un mein paisa pehle se para
  // tha, magar kisi ne system ko bataya hi nahi. Phir jab diesel ka
  // paisa nikla to sifar mein se nikla, aur adad manfi ho gaya.
  //
  // Ab wohi ek raasta hai jo neeche `setOpeningBalance` mein hai: ek
  // qatar Cash Book mein, ek entry ledger mein, dono ek sath.
  if (openingBalance > 0 && account) {
    const opening = new FormData();
    opening.set("account_id", account.id);
    opening.set("amount", String(openingBalance));
    opening.set("as_of_date", String(formData.get("as_of_date") ?? aajKaKhana()));
    const r = await setOpeningBalance({}, opening);
    if (r.error) return { error: `Khata ban gaya, magar shuruati balance darj nahi hua: ${r.error}` };
  }

  revalidatePath("/admin/finance");
  return { success: true };
}

/**
 * Khate ka shuruati balance -- ek dafa, dono kitabon mein.
 *
 * Malik ka sawal (5 September): *"ye jo minus balance aa raha hai ye
 * kahan se aaya hai? Ise bhi set karein."*
 *
 * Jawab seedha tha: kisi khate ka shuruati balance kabhi darj hi nahi
 * hua. UBL, Alfalah, HBL aur cash box -- charon sifar par bane. Phir 31
 * August ko UBL se diesel ka Rs 11,370 nikla aur 4 September ko cash box
 * se Rs 11,280. Paisa waqai nikla, magar system ke hisaab se wo khate
 * KHALI the -- is liye adad manfi ho gaya. Ye system ki ghalti nahi;
 * ye wo baat hai jo us ko batai hi nahi gayi thi.
 *
 * Do usool yahan lage hue hain:
 *
 * 1. **Dono kitabein ek sath.** Cash Book mein qatar, ledger mein entry
 *    (khata debit, "Malik ka sarmaya" 3200 credit). Sirf `opening_balance`
 *    ka khana bharna wohi purani ghalti hai: Cash Book theek dikhta,
 *    Trial Balance ghalat rehta.
 *
 * 2. **Ek dafa.** Shuruati balance dobara darj ho jaye to poori kitab
 *    do dafa gin leti hai. Is liye pehle se maujood ho to saaf mana --
 *    badalna ho to purani entry reverse karni parti hai, taake dono
 *    qatarein nazar aayein.
 */
export async function setOpeningBalance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Shuruati balance darj karna");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();

  const accountId = String(formData.get("account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const asOf = String(formData.get("as_of_date") ?? aajKaKhana());

  if (!accountId) return { error: "Khata chunein." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Raqam sifar se zyada honi chahiye. Khata waqai khali tha to shuruati balance darj karne ki zaroorat hi nahi." };
  }

  const { data: account } = await supabase
    .from("finance_accounts")
    .select("id, name, opening_balance")
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return { error: "Khata nahi mila." };

  // Pehle se darj to nahi? Do jagah dekhni parti hain, kyunki purane
  // khate `opening_balance` ke khane par bane the.
  if (Number(account.opening_balance) > 0) {
    return { error: `${account.name} ka shuruati balance pehle se darj hai (Rs ${Number(account.opening_balance).toLocaleString()}).` };
  }
  const { data: pehleSe } = await supabase
    .from("finance_transactions")
    .select("id")
    .eq("account_id", accountId)
    .eq("category", "Shuruati balance")
    .maybeSingle();
  if (pehleSe) {
    return { error: `${account.name} ka shuruati balance pehle hi darj ho chuka hai. Badalna ho to purani entry ledger se reverse karein.` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const description = `Shuruati balance — ${account.name} (${asOf} tak)`;

  const { data: row, error } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: "income",
      category: "Shuruati balance",
      amount,
      transaction_date: asOf,
      notes: description,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Doosra rukh: ye aamdani nahi hai. Paisa kamaya nahi gaya, wo pehle
  // se malik ka tha -- is liye "Malik ka sarmaya" (3200), koi income
  // khata nahi. Warna pehle hi din ka nafa jhoota nazar aata.
  const posted = await postCashIn({
    accountId,
    amount,
    category: "Shuruati balance",
    againstAccount: ACC.openingEquity,
    description,
    ctx: {
      createdBy: user?.id ?? null,
      entryDate: asOf,
      claims: [{ table: "finance_transactions", rowId: row.id }],
    },
  });

  if (failed(posted)) {
    // Ledger mein na gaya to Cash Book ki qatar bhi nahi rehni chahiye --
    // warna dono kitabein usi din alag ho jatin jis din ye feature ban
    // raha tha.
    // Mitate NAHI (finance review #9) -- ulti qatar daalte hain, taake
    // Cash Book barabar ho jaye aur dono qataren saboot ke taur par rahein.
    await supabase.from("finance_transactions").insert({
      account_id: accountId,
      transaction_type: "expense",
      category: "Shuruati balance",
      amount,
      transaction_date: asOf,
      notes: `Reversal — ${description} (ledger mein nahi gaya)`,
      created_by: user?.id ?? null,
    });
    return { error: `Ledger mein nahi ja saka, is liye shuruati balance darj nahi kiya: ${posted.error}` };
  }

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  revalidatePath("/admin/finance/reports");
  return { success: true };
}

export async function recordFinanceTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Cash Book mein aamdani/kharcha darj karna");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();

  const accountId = String(formData.get("account_id") ?? "");
  const type = String(formData.get("transaction_type") ?? "");
  const category = (formData.get("category") as string) || null;
  const amount = Number(formData.get("amount") ?? 0);
  const transactionDate = String(formData.get("transaction_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

  if (!accountId) return { error: "Account is required." };
  if (!["income", "expense"].includes(type)) return { error: "Invalid transaction type." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };

  if (clientActionId) {
    const against = type === "income" ? incomeAccountFor(category) : expenseAccountFor(category);
    const { data, error } = await (supabase as any).rpc("fn_post_finance_atomic", {
      p_mode: type, p_account_id: accountId, p_amount: amount, p_category: category,
      p_transaction_date: transactionDate, p_notes: notes, p_against_account: against,
      p_client_action_id: clientActionId,
    });
    if (error) return { error: error.message };
    if (data?.success) { revalidatePath("/admin/finance"); return { success: true }; }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: accountId,
      transaction_type: type as "income" | "expense",
      category,
      amount,
      transaction_date: transactionDate,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Cash row ban gayi -- ab us ka doosra rukh. Ye qadam chhoot jaye to
  // raqam Money Trail par "abhi ledger tak nahi pahunchi" mein nazar
  // aayegi, chup chaap gum nahi hogi.
  const description = notes?.trim() || `${category ?? "Cash"} — Rs ${amount.toLocaleString()}`;
  const ctx = {
    createdBy: user?.id ?? null,
    entryDate: transactionDate,
    claims: [{ table: "finance_transactions", rowId: row.id }],
  };
  const posted =
    type === "income"
      ? await postCashIn({ accountId, amount, category, description, ctx })
      : await postCashOut({ accountId, amount, category, description, ctx });

  if (failed(posted)) return { error: `Entry to ban gayi magar ledger mein nahi ja saki: ${posted.error}` };

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

export async function transferBetweenAccounts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Khaton ke darmiyan transfer");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();

  const fromAccountId = String(formData.get("from_account_id") ?? "");
  const toAccountId = String(formData.get("to_account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const transactionDate = String(formData.get("transaction_date") ?? aajKaKhana());
  const notes = (formData.get("notes") as string) || null;
  const clientActionId = String(formData.get("client_action_id") ?? "").trim() || null;

  if (!fromAccountId || !toAccountId) return { error: "Both accounts are required." };
  if (fromAccountId === toAccountId) return { error: "Source and destination must be different." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than zero." };

  // Finance review #8: pehle sirf "nikla" qadam -- paisa 1020 (Cash in
  // Transit) mein nazar aata rahe jab tak doosra Admin wusooli darj na
  // kare (receiveTransfer). Migration 522 na lagi ho to purana raasta.
  const pending = await startPendingTransfer({
    supabase, fromAccountId, toAccountId, amount, transactionDate, notes, userId: gate.userId,
  });
  if (pending !== "legacy") return pending;

  if (clientActionId) {
    const { data, error } = await (supabase as any).rpc("fn_post_finance_atomic", {
      p_mode: "transfer", p_account_id: fromAccountId, p_to_account_id: toAccountId,
      p_amount: amount, p_transaction_date: transactionDate, p_notes: notes,
      p_client_action_id: clientActionId,
    });
    if (error) return { error: error.message };
    if (data?.success) { revalidatePath("/admin/finance"); return { success: true }; }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const transferId = crypto.randomUUID();

  const { data: outRow, error: outError } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: fromAccountId,
      transaction_type: "transfer_out",
      category: "Transfer",
      amount,
      transaction_date: transactionDate,
      notes,
      related_transfer_id: transferId,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (outError) return { error: outError.message };

  const { data: inRow, error: inError } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: toAccountId,
      transaction_type: "transfer_in",
      category: "Transfer",
      amount,
      transaction_date: transactionDate,
      notes,
      related_transfer_id: transferId,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (inError) return { error: inError.message };

  // Transfer ke DO qadam hain, is liye DO entries -- ek nikalne ki, ek
  // pahunchne ki, aur beech mein "Cash in Transit". Ek hi entry banayein
  // to wo raqam kabhi nazar nahi aayegi jo nikli to thi magar pahunchi
  // nahi.
  const label = notes?.trim() || `Transfer — Rs ${amount.toLocaleString()}`;
  const base = { createdBy: user?.id ?? null, entryDate: transactionDate };

  const out = await postTransferOut({
    fromAccountId,
    amount,
    description: `${label} (nikla)`,
    ctx: { ...base, claims: [{ table: "finance_transactions", rowId: outRow.id }] },
  });
  if (failed(out)) return { error: `Transfer hua magar ledger mein nahi gaya: ${out.error}` };

  const inn = await postTransferIn({
    toAccountId,
    amount,
    description: `${label} (pahuncha)`,
    ctx: { ...base, claims: [{ table: "finance_transactions", rowId: inRow.id }] },
  });
  if (failed(inn)) return { error: `Transfer hua magar ledger mein adhoora raha: ${inn.error}` };

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

type Supa = ReturnType<typeof createClient>;

async function startPendingTransfer(args: {
  supabase: Supa;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  transactionDate: string;
  notes: string | null;
  userId: string;
}): Promise<ActionState | "legacy"> {
  const loose = args.supabase as unknown as { from: (t: string) => any };
  const probe = await loose.from("finance_transactions").select("transfer_to_account_id").limit(1);
  if (probe.error) return "legacy";

  const transferId = crypto.randomUUID();
  const { data: outRow, error } = await loose
    .from("finance_transactions")
    .insert({
      account_id: args.fromAccountId,
      transaction_type: "transfer_out",
      category: "Transfer",
      amount: args.amount,
      transaction_date: args.transactionDate,
      notes: args.notes,
      related_transfer_id: transferId,
      transfer_to_account_id: args.toAccountId,
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const label = args.notes?.trim() || `Transfer — Rs ${args.amount.toLocaleString()}`;
  const out = await postTransferOut({
    fromAccountId: args.fromAccountId,
    amount: args.amount,
    description: `${label} (nikla — raste mein)`,
    ctx: { createdBy: args.userId, entryDate: args.transactionDate, claims: [{ table: "finance_transactions", rowId: outRow.id }] },
  });
  if (failed(out)) return { error: `Transfer ledger mein nahi gaya: ${out.error}` };

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  return { success: true };
}

/**
 * Transfer ki wusooli -- doosri taraf paisa pahunch gaya.
 * Sirf Admin darje ka banda, aur (Owner ke ilawa) wo nahi jis ne bheja.
 */
export async function receiveTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requireMoneyAdmin("Transfer ki wusooli darj karna");
  if (!gate.ok) return { error: gate.error };
  const supabase = createClient();
  const loose = supabase as unknown as { from: (t: string) => any };

  const transferId = String(formData.get("related_transfer_id") ?? "").trim();
  const receivedDate = String(formData.get("received_date") ?? "").trim() || aajKaKhana();
  if (!transferId) return { error: "Kaunsa transfer, wo saaf nahi." };

  const { data: rows, error } = await loose
    .from("finance_transactions")
    .select("id, account_id, transaction_type, amount, notes, created_by, transfer_to_account_id, transaction_date")
    .eq("related_transfer_id", transferId);
  if (error) return { error: error.message };
  const out = (rows ?? []).find((r: { transaction_type: string }) => r.transaction_type === "transfer_out");
  if (!out || !out.transfer_to_account_id) return { error: "Raste wala transfer nahi mila." };
  if ((rows ?? []).some((r: { transaction_type: string }) => r.transaction_type === "transfer_in")) {
    return { error: "Ye transfer pehle hi wusool ho chuka hai." };
  }
  if (out.created_by === gate.userId && gate.role !== "owner") {
    return { error: "Jis ne transfer bheja wo khud wusooli darj nahi kar sakta. Doosre Admin se karwayein." };
  }
  if (receivedDate < String(out.transaction_date)) return { error: "Wusooli ki tareekh bhejne se pehle ki nahi ho sakti." };

  const amount = Number(out.amount);
  const { data: inRow, error: inError } = await supabase
    .from("finance_transactions")
    .insert({
      account_id: out.transfer_to_account_id,
      transaction_type: "transfer_in",
      category: "Transfer",
      amount,
      transaction_date: receivedDate,
      notes: out.notes,
      related_transfer_id: transferId,
      created_by: gate.userId,
    })
    .select("id")
    .single();
  if (inError) return { error: inError.message };

  const label = out.notes?.trim() || `Transfer — Rs ${amount.toLocaleString()}`;
  const inn = await postTransferIn({
    toAccountId: out.transfer_to_account_id,
    amount,
    description: `${label} (pahuncha)`,
    ctx: { createdBy: gate.userId, entryDate: receivedDate, claims: [{ table: "finance_transactions", rowId: inRow.id }] },
  });
  if (failed(inn)) return { error: `Wusooli ledger mein nahi gayi: ${inn.error}` };

  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  return { success: true };
}
