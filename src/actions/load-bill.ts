"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal, reverseJournal, type JournalLine } from "@/lib/ledger/post";
import { ACC, glForFinanceAccount } from "@/lib/ledger/rules";
import { recordError } from "@/lib/errors/record";

export interface LoadState {
  error?: string;
  success?: boolean;
  notice?: string;
  txnNumber?: string;
}

/** Wo log jo float mein paisa daal sakte hain aur farq manzoor karte hain. */
const FLOAT_ROLES = ["owner", "super_admin", "admin", "finance", "manager"];

function paisa(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Customer se paisa kis khate mein aaya.
 *
 * Char raaste, aur charon ka matlab alag hai. Sab ko "cash" maan lena wo
 * ghalti hoti jo raat ki ginti mein nikalti hai: golak mein utna paisa
 * hota hi nahi jitna kitab keh rahi hoti.
 */
async function receivingLine(
  method: string,
  amount: number,
  financeAccountId: string | null,
  customerId: string | null,
  memo: string
): Promise<JournalLine | { error: string }> {
  if (method === "cash") return { account: ACC.cash, debit: amount, memo };
  if (method === "bank") {
    if (!financeAccountId) return { error: "Bank se adaigi par khata chunna zaroori hai." };
    return { account: await glForFinanceAccount(financeAccountId), debit: amount, memo };
  }
  // Wallet se dena customer ka apna paisa kharch karna hai -- hamara us
  // par bojh (2040) utna kam ho jata hai.
  if (method === "wallet") return { account: ACC.walletPayable, debit: amount, memo };
  if (method === "khata") {
    if (!customerId) return { error: "Khate par likhne ke liye customer chunna zaroori hai." };
    return { account: ACC.customerDue, debit: amount, partyType: "customer", partyId: customerId, memo };
  }
  return { error: "Adaigi ka tareeqa samajh nahi aaya." };
}

/**
 * Commission ka ANDAZA -- qaide se.
 *
 * Ye adad khate mein KABHI nahi jata. Malik ka usool: "agar commission
 * immediately confirm nahi hoti to system fake earning calculate na
 * kare." Qaida na mile to jawab NULL hai -- sifar nahi. "Commission
 * sifar hai" aur "commission ka qaida darj hi nahi" do alag baatein
 * hain, aur doosri ko pehli samajh lena is project mein teen dafa ghalat
 * adad de chuka hai.
 */
async function commissionGuess(providerId: string, kind: string, principal: number): Promise<number | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("load_commission_rules")
    .select("mode, value")
    .eq("provider_id", providerId)
    .eq("kind", kind)
    .eq("is_active", true)
    .lte("from_date", new Date().toISOString().slice(0, 10))
    .order("from_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const v = Number(data.value);
  if (!Number.isFinite(v)) return null;
  return data.mode === "fisad"
    ? Math.round(principal * v) / 100
    : Math.round(v * 100) / 100;
}

/**
 * Load ya bill darj karna.
 *
 * Dhyan rahe: ye function load BHEJTA nahi. Load provider ki apni app se
 * jata hai; yahan sirf us ka indraj hota hai. Isi liye `provider_tid`
 * (provider ki apni reference) hi wo cheez hai jo qatar ko `saboot_baqi`
 * se `darj` banati hai.
 */
export async function createLoadTransaction(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { error: "Aap ka khata band hai." };

  const accountId = String(formData.get("account_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "load").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const principal = paisa(formData.get("principal"));
  const serviceCharge = paisa(formData.get("service_charge"));
  const method = String(formData.get("payment_method") ?? "cash").trim();
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim() || null;
  const customerId = String(formData.get("customer_id") ?? "").trim() || null;
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;
  const providerTid = String(formData.get("provider_tid") ?? "").trim() || null;
  const billCategory = String(formData.get("bill_category") ?? "").trim() || null;
  // Bill ka paisa abhi provider tak pahuncha ya nahi. Load par hamesha
  // pahunch chuka hota hai.
  const settled = kind === "bill" ? formData.get("float_settled") === "on" : true;

  if (!accountId) return { error: "Provider ka account chunein." };
  if (!reference) {
    return {
      error: kind === "bill" ? "Consumer / reference number likhein." : "Mobile number likhein.",
    };
  }
  if (principal === null || principal <= 0) {
    return { error: "Raqam likhein — sifar ya khali raqam ka load nahi hota." };
  }
  if (serviceCharge !== null && serviceCharge <= 0) {
    return { error: "Service charge sifar nahi hota. Customer se kuch extra nahi liya to khana khali chhor dein." };
  }

  const service = createServiceClient();

  const { data: account } = await service
    .from("load_accounts")
    .select("id, provider_id, title, branch_id, is_active")
    .eq("id", accountId)
    .maybeSingle();
  if (!account?.is_active) return { error: "Ye provider account band hai." };

  // Float kaafi hai ya nahi -- ye sawal darj karne se PEHLE poochna hai.
  // Baad mein poochne ka matlab hai ke float manfi ho chuka hoga, aur
  // manfi float ka koi maani nahi: provider ne to load bhejne se inkaar
  // kar diya hoga.
  if (settled) {
    const { data: balance, error: balErr } = await supabase.rpc("fn_load_float_balance", {
      p_account: accountId,
      p_upto: null,
    });
    if (balErr) {
      return { error: `Float ka balance parha nahi ja saka: ${balErr.message}` };
    }
    const available = Number(balance ?? 0);
    if (available < principal) {
      return {
        error: `Is account mein sirf Rs ${available.toLocaleString()} float hai — Rs ${principal.toLocaleString()} ka kaam nahi ho sakta. Pehle float mein paisa daalein.`,
      };
    }
  }

  const branchId = me.branch_id ?? account.branch_id ?? null;
  const total = Math.round((principal + (serviceCharge ?? 0)) * 100) / 100;

  const received = await receivingLine(
    method,
    total,
    financeAccountId,
    customerId,
    `${kind === "bill" ? "Bill" : "Load"} — ${reference}`
  );
  if ("error" in received) return { error: received.error };

  const txnNumber = await service.rpc("fn_next_load_number", { p_kind: kind });
  const number = String(txnNumber.data ?? "");
  if (!number) return { error: "Qatar ka number nahi ban saka." };

  const guess = await commissionGuess(account.provider_id as string, kind, principal);

  const { data: row, error: insErr } = await service
    .from("load_transactions")
    .insert({
      txn_number: number,
      account_id: accountId,
      provider_id: account.provider_id,
      kind,
      bill_category: billCategory,
      reference,
      principal,
      service_charge: serviceCharge,
      commission_expected: guess,
      commission_status: "muntazir",
      payment_method: method,
      finance_account_id: financeAccountId,
      customer_id: customerId,
      customer_name: customerName,
      provider_tid: providerTid,
      // Saboot laga hua ho to seedha darj; warna qatar khud kehti hai ke
      // us par saboot baqi hai.
      status: providerTid ? "darj" : "saboot_baqi",
      float_settled: settled,
      branch_id: branchId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !row) {
    await recordError({
      module: "load-bill",
      route: "/admin/load-bill",
      message: insErr?.message ?? "Load qatar nahi bani",
      severity: "rukawat",
      actorId: user.id,
    });
    return { error: `Qatar nahi bani: ${insErr?.message ?? "wajah maloom nahi"}` };
  }

  // Asal raqam AAMDANI NAHI hai -- wo customer ka paisa hai jo provider
  // tak ja raha hai. Aamdani sirf service charge hai. Commission yahan
  // nahi aati: wo statement ki tasdeeq ke baad aati hai.
  const lines: JournalLine[] = [received];
  lines.push(
    settled
      ? {
          account: ACC.loadFloat,
          credit: principal,
          partyType: "load_account",
          partyId: accountId,
          memo: `${number} — ${reference}`,
        }
      : {
          // Bill le liya magar provider tak nahi pahuncha: ye paisa
          // hamare paas hai magar hamara nahi.
          account: ACC.billsCollected,
          credit: principal,
          memo: `${number} — ${reference} (abhi ada nahi)`,
        }
  );
  if (serviceCharge) {
    lines.push({ account: ACC.loadServiceCharge, credit: serviceCharge, memo: `${number} service charge` });
  }

  const posted = await postJournal({
    description: `${kind === "bill" ? "Bill payment" : "Mobile load"} ${number} — ${reference}`,
    sourceModule: "load_bill",
    sourceId: row.id,
    branchId,
    createdBy: user.id,
    lines,
    claims: [{ table: "load_transactions", rowId: row.id }],
  });

  if ("error" in posted) {
    // Ledger mein na ja saki to qatar bhi nahi rehni chahiye -- warna
    // safha ek aisa kaam dikhata rahega jo hisaab mein hai hi nahi.
    await service.from("load_transactions").delete().eq("id", row.id);
    return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };
  }

  await service.from("load_transactions").update({ journal_entry_id: posted.id }).eq("id", row.id);

  revalidatePath("/admin/load-bill");
  return {
    success: true,
    txnNumber: number,
    notice: providerTid
      ? `${number} darj ho gaya.`
      : `${number} darj ho gaya — magar provider ki TID abhi nahi lagi. Jab tak wo na lage, is qatar par "saboot baqi" likha rahega.`,
  };
}

/**
 * Provider ki TID baad mein lagana.
 *
 * Saboot lagne se qatar ka paisa nahi badalta -- sirf ye badalta hai ke
 * hum us par bharosa kar sakte hain ya nahi. Is liye yahan koi journal
 * nahi banti.
 */
export async function attachProviderTid(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const id = String(formData.get("id") ?? "").trim();
  const tid = String(formData.get("provider_tid") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  if (tid.length < 3) return { error: "Provider ki TID likhein — provider ki app mein jo reference dikhta hai." };

  const service = createServiceClient();
  const { error } = await service
    .from("load_transactions")
    .update({ provider_tid: tid, status: "darj" })
    .eq("id", id)
    .eq("status", "saboot_baqi");

  if (error) return { error: error.message };

  revalidatePath("/admin/load-bill");
  return { success: true, notice: "Saboot lag gaya." };
}

/**
 * Float mein paisa daalna.
 *
 * Ye KHARCHA NAHI hai -- paisa bank/golak se nikal kar provider ke
 * account mein gaya, bas. Is ko kharcha likhna wohi ghalti hoti jo is
 * project mein machinery ke advance par ho chuki hai: nafa nuqsan ka
 * safha bilkul ghalat tasveer dikhane lagta hai.
 */
export async function rechargeFloat(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !FLOAT_ROLES.includes(me.role)) {
    return { error: "Float mein paisa daalna sirf Manager, Finance ya Admin ka kaam hai." };
  }

  const accountId = String(formData.get("account_id") ?? "").trim();
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim();
  const amount = paisa(formData.get("amount"));
  const note = String(formData.get("reason") ?? "").trim() || null;

  if (!accountId) return { error: "Provider ka account chunein." };
  if (!financeAccountId) return { error: "Paisa kis khate se gaya — wo khata chunein." };
  if (amount === null || amount <= 0) return { error: "Raqam likhein." };

  const service = createServiceClient();

  const { data: account } = await service
    .from("load_accounts")
    .select("id, title, branch_id, is_active")
    .eq("id", accountId)
    .maybeSingle();
  if (!account?.is_active) return { error: "Ye provider account band hai." };

  const { data: move, error: insErr } = await service
    .from("load_float_moves")
    .insert({
      account_id: accountId,
      kind: "recharge",
      amount,
      finance_account_id: financeAccountId,
      reason: note,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !move) return { error: `Indraj nahi hua: ${insErr?.message ?? ""}` };

  const posted = await postJournal({
    description: `Float recharge — ${account.title}`,
    sourceModule: "load_float",
    sourceId: move.id,
    branchId: me.branch_id ?? account.branch_id ?? null,
    createdBy: user.id,
    lines: [
      {
        account: ACC.loadFloat,
        debit: amount,
        partyType: "load_account",
        partyId: accountId,
        memo: note ?? "Float recharge",
      },
      { account: await glForFinanceAccount(financeAccountId), credit: amount, memo: `Float — ${account.title}` },
    ],
    claims: [{ table: "load_float_moves", rowId: move.id }],
  });

  if ("error" in posted) {
    await service.from("load_float_moves").delete().eq("id", move.id);
    return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };
  }

  await service.from("load_float_moves").update({ journal_entry_id: posted.id }).eq("id", move.id);

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/load-bill/accounts");
  return { success: true, notice: `Rs ${amount.toLocaleString()} float mein chala gaya.` };
}

/**
 * Wo bill jo le liya tha magar provider tak nahi pahuncha tha -- ab
 * pahunch gaya.
 *
 * Ab wo bojh (2060) utar kar float se kat jata hai.
 */
export async function settleBill(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };

  const service = createServiceClient();
  const { data: txn } = await service
    .from("load_transactions")
    .select("id, txn_number, account_id, principal, float_settled, status, branch_id, reference")
    .eq("id", id)
    .maybeSingle();

  if (!txn) return { error: "Qatar nahi mili." };
  if (txn.float_settled) return { error: "Ye bill pehle hi provider tak pahunch chuka hai." };
  if (txn.status === "wapas" || txn.status === "nakaam") {
    return { error: "Ye qatar wapas ho chuki hai — us par adaigi nahi hoti." };
  }

  const principal = Number(txn.principal);
  const { data: balance } = await supabase.rpc("fn_load_float_balance", {
    p_account: txn.account_id,
    p_upto: null,
  });
  if (Number(balance ?? 0) < principal) {
    return { error: `Float mein sirf Rs ${Number(balance ?? 0).toLocaleString()} hai — ye bill ada nahi ho sakta.` };
  }

  const posted = await postJournal({
    description: `Bill ada — ${txn.txn_number} (${txn.reference})`,
    sourceModule: "load_bill_settle",
    sourceId: txn.id,
    branchId: txn.branch_id,
    createdBy: user.id,
    lines: [
      { account: ACC.billsCollected, debit: principal, memo: `${txn.txn_number} ada hua` },
      {
        account: ACC.loadFloat,
        credit: principal,
        partyType: "load_account",
        partyId: txn.account_id as string,
        memo: `${txn.txn_number} ada hua`,
      },
    ],
  });

  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  await service.from("load_transactions").update({ float_settled: true }).eq("id", id);

  revalidatePath("/admin/load-bill");
  return { success: true, notice: `${txn.txn_number} provider tak pahunch gaya.` };
}

/**
 * Qatar wapas karna.
 *
 * Mitai nahi jati -- ulti jati hai. Mitane se ghalti ke sath us ka
 * nishan bhi chala jata hai, aur phir koi nahi bata sakta ke us din
 * kaam hua tha ya nahi.
 */
export async function reverseLoadTransaction(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !FLOAT_ROLES.includes(me.role)) {
    return { error: "Qatar wapas karna sirf Manager, Finance ya Admin ka kaam hai." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return { error: "Qatar nahi mili." };
  if (reason.length < 5) return { error: "Wapas karne ki wajah likhein." };

  const service = createServiceClient();
  const { data: txn } = await service
    .from("load_transactions")
    .select("id, txn_number, journal_entry_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!txn) return { error: "Qatar nahi mili." };
  if (txn.status === "wapas") return { error: "Ye qatar pehle hi wapas ho chuki hai." };
  if (!txn.journal_entry_id) return { error: "Is qatar ki ledger entry nahi mili." };

  const reversed = await reverseJournal(txn.journal_entry_id as string, reason, user.id);
  if ("error" in reversed) return { error: reversed.error };

  await service.from("load_transactions").update({ status: "wapas" }).eq("id", id);

  revalidatePath("/admin/load-bill");
  return { success: true, notice: `${txn.txn_number} wapas ho gaya (${reversed.entryNumber}).` };
}

/**
 * Shaam ka milan.
 *
 * Kaghaz ka adad khud ko kabhi ghalat nahi kehta. Float ka asal balance
 * sirf provider ki app mein dekh kar maloom hota hai -- yehi wo ek qadam
 * hai jo poore hisaab ko haqeeqat se bandhta hai.
 *
 * Malik ka usool: "Rs 1 ka farq ho sakta hai, lekin Rs 1 unexplained
 * nahi rehna chahiye."
 */
export async function saveLoadReconciliation(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { error: "Aap ka khata band hai." };

  const accountId = String(formData.get("account_id") ?? "").trim();
  const tareekh = String(formData.get("tareekh") ?? "").trim();
  const actual = paisa(formData.get("actual_closing"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!accountId || !tareekh) return { error: "Account aur tareekh chunein." };
  if (actual === null) {
    return { error: "Provider ki app mein jo balance dikh raha hai wo likhein. Khali chhorne ka matlab hai ke dekha hi nahi gaya." };
  }
  if (actual < 0) return { error: "Balance manfi nahi hota." };

  const service = createServiceClient();

  const { data: sum, error: sumErr } = await supabase.rpc("fn_load_day_summary", {
    p_account: accountId,
    p_date: tareekh,
  });
  if (sumErr) return { error: `Din ka hisaab nahi bana: ${sumErr.message}` };

  const row = Array.isArray(sum) ? sum[0] : sum;
  if (!row) return { error: "Us din ka hisaab nahi mila." };

  const expected = Number(row.expected_closing ?? 0);
  const farq = Math.round((actual - expected) * 100) / 100;

  if (farq !== 0 && reason.length < 5) {
    return {
      error: `Farq Rs ${Math.abs(farq).toLocaleString()} ka hai — us ki wajah likhein. Rs 1 ka farq ho sakta hai, magar Rs 1 be-wajah nahi reh sakta.`,
    };
  }

  // Farq ledger mein bhi jata hai, warna float ka hisaab kaghaz par kuch
  // aur rehta aur haqeeqat mein kuch aur.
  let journalEntryId: string | null = null;
  if (farq !== 0) {
    if (!FLOAT_ROLES.includes(me.role)) {
      return { error: "Farq khate mein daalna sirf Manager, Finance ya Admin ka kaam hai. Aap ginti likh sakte hain, farq wo manzoor karenge." };
    }
    const amount = Math.abs(farq);
    const posted = await postJournal({
      description: `Float ka farq — ${tareekh}`,
      sourceModule: "load_reconcile",
      entryDate: tareekh,
      branchId: me.branch_id,
      createdBy: user.id,
      backdateReason: tareekh < new Date().toISOString().slice(0, 10) ? `Us din ka milan aaj darj hua — ${reason}` : null,
      lines:
        farq < 0
          ? // Float kam nikla: kami kharche mein gayi.
            [
              { account: ACC.floatDifference, debit: amount, memo: reason },
              { account: ACC.loadFloat, credit: amount, partyType: "load_account", partyId: accountId, memo: `Milan ${tareekh}` },
            ]
          : // Float zyada nikla: farq wapas kharche se kata.
            [
              { account: ACC.loadFloat, debit: amount, partyType: "load_account", partyId: accountId, memo: `Milan ${tareekh}` },
              { account: ACC.floatDifference, credit: amount, memo: reason },
            ],
    });
    if ("error" in posted) return { error: `Farq ledger mein darj nahi ho saka: ${posted.error}` };
    journalEntryId = posted.id;
  }

  const { error } = await service.from("load_reconciliations").upsert(
    {
      account_id: accountId,
      tareekh,
      opening_float: Number(row.opening_float ?? 0),
      float_added: Number(row.float_added ?? 0),
      load_principal: Number(row.load_principal ?? 0),
      bill_principal: Number(row.bill_principal ?? 0),
      adjustments: Number(row.adjustments ?? 0),
      expected_closing: expected,
      actual_closing: actual,
      farq,
      reason: farq === 0 ? null : reason,
      status: farq === 0 ? "mila" : "manzoor",
      journal_entry_id: journalEntryId,
      created_by: user.id,
      approved_by: farq === 0 ? null : user.id,
    },
    { onConflict: "account_id,tareekh" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/load-bill/reconcile");
  return {
    success: true,
    notice: farq === 0 ? "Mil gaya — koi farq nahi." : `Farq Rs ${Math.abs(farq).toLocaleString()} darj ho gaya.`,
  };
}

/**
 * Naya provider account banana.
 *
 * Shuru ka float (opening) khali reh sakta hai -- us ka matlab hai "abhi
 * darj nahi hua", sifar nahi. Magar agar likha jaye to wo sirf ek khane
 * mein nahi baithta: us ki bhi ledger entry banti hai (1190 debit,
 * shuruati sarmaya credit).
 *
 * Ye baat pehle Finance ke khaton par ghalti kar chuki hai: wahan
 * opening balance sirf `opening_balance` ke khane mein para reh gaya tha
 * aur ledger use jaanta hi nahi tha -- phir do adad ban gaye. Yahan wo
 * ghalti dobara nahi hone di gayi.
 */
export async function createLoadAccount(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !FLOAT_ROLES.includes(me.role)) {
    return { error: "Provider ka account banana sirf Manager, Finance ya Admin ka kaam hai." };
  }

  const providerId = String(formData.get("provider_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const accountRef = String(formData.get("account_ref") ?? "").trim() || null;
  const opening = paisa(formData.get("opening_float"));

  if (!providerId) return { error: "Provider chunein." };
  if (title.length < 2) return { error: "Account ka naam likhein (jaise: Jazz retailer — Main Branch)." };
  if (opening !== null && opening < 0) return { error: "Shuru ka float manfi nahi hota." };

  const service = createServiceClient();

  const { data: row, error: insErr } = await service
    .from("load_accounts")
    .insert({
      provider_id: providerId,
      title,
      account_ref: accountRef,
      branch_id: me.branch_id,
      opening_float: opening,
      opened_on: new Date().toISOString().slice(0, 10),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !row) return { error: `Account nahi bana: ${insErr?.message ?? ""}` };

  // Shuru ka float ledger mein bhi -- warna safha kuch aur kehta aur
  // ledger kuch aur.
  if (opening && opening > 0) {
    const posted = await postJournal({
      description: `Shuru ka float — ${title}`,
      sourceModule: "load_float_opening",
      sourceId: row.id,
      branchId: me.branch_id,
      createdBy: user.id,
      lines: [
        {
          account: ACC.loadFloat,
          debit: opening,
          partyType: "load_account",
          partyId: row.id,
          memo: "Shuru ka float",
        },
        { account: ACC.openingEquity, credit: opening, memo: `Shuru ka float — ${title}` },
      ],
      claims: [{ table: "load_accounts", rowId: row.id }],
    });

    if ("error" in posted) {
      await service.from("load_accounts").delete().eq("id", row.id);
      return { error: `Shuru ka float ledger mein nahi gaya: ${posted.error}` };
    }
  }

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/load-bill/accounts");
  return {
    success: true,
    notice: opening
      ? `${title} ban gaya — shuru ka float Rs ${opening.toLocaleString()}.`
      : `${title} ban gaya. Shuru ka float darj nahi hua — float mein paisa daal kar shuru karein.`,
  };
}
