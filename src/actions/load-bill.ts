"use server";

import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postDeskTransaction } from "@/lib/ledger/desk";
import { postJournal, reverseJournal, type JournalLine } from "@/lib/ledger/post";
import { ACC, glForFinanceAccount } from "@/lib/ledger/rules";
import { cashBookLikhein, type CashBookQatar } from "@/lib/ledger/cash-book";
import { recordError } from "@/lib/errors/record";
import { notifyUser } from "@/lib/notifications";
import { requireAction } from "@/lib/access/guard";

export interface LoadState {
  error?: string;
  success?: boolean;
  notice?: string;
  txnNumber?: string;
}

async function staffShop(supabase: ReturnType<typeof createClient>, userId: string, assigned: string | null): Promise<string | null> {
  if (assigned) return assigned;
  const { data, error } = await supabase.from("pos_shifts").select("pos_counters!inner(shop_id)").eq("staff_id", userId).eq("status", "open");
  if (error || data?.length !== 1) return null;
  const counter = Array.isArray(data[0].pos_counters) ? data[0].pos_counters[0] : data[0].pos_counters;
  return counter?.shop_id ?? null;
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
  partyType: "customer" | "farmer" | null,
  partyId: string | null,
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
    if (!partyType || !partyId) return { error: "Khate par likhne ke liye customer ya kisan chunna zaroori hai." };
    const account = partyType === "farmer" ? ACC.farmerDue : ACC.customerDue;
    return { account, debit: amount, partyType, partyId, memo };
  }
  return { error: "Adaigi ka tareeqa samajh nahi aaya." };
}

/**
 * Is provider account ka ASAL khata (GL code).
 *
 * 332 se pehle float ka apna khata tha (1190). Wo ghalat tha: malik ka
 * CBA account Finance mein pehle se maujood hai, aur do jagah ginne se
 * ek hi paise ke do adad ban jate hain.
 *
 * Ab har provider account ek asal finance account se juRa hota hai, aur
 * har qatar usi ke khate par jati hai. NULL ka matlab hai ke wo juRa hi
 * nahi -- us surat mein koi qatar nahi banti, kyunki humein pata hi nahi
 * ke paisa kis khate se nikla.
 */
async function loadAccountFinanceId(accountId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("load_accounts")
    .select("finance_account_id")
    .eq("id", accountId)
    .maybeSingle();
  return (data?.finance_account_id as string | null) ?? null;
}

async function loadAccountGl(accountId: string): Promise<string | null> {
  const finId = await loadAccountFinanceId(accountId);
  if (!finId) return null;
  return glForFinanceAccount(finId);
}

/**
 * Customer ka paisa kis Cash Book ke khate mein aaya.
 *
 * Sirf cash aur bank/wallet ke khate Cash Book mein hote hain. "Wallet"
 * (customer ka apna jama shuda paisa) aur "Khata" (udhaar) kisi khate
 * mein paisa laate hi nahi -- wahan jawab NULL hai, sifar nahi.
 */
function receivingCashBook(
  method: string,
  financeAccountId: string | null
): { accountId?: string; glCode?: string } | null {
  if (method === "cash") return { glCode: ACC.cash };
  if (method === "bank" && financeAccountId) return { accountId: financeAccountId };
  return null;
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
    .lte("from_date", aajKaKhana())
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
  const permission = await requireAction("load-bill", "create");
  if ("error" in permission) return { error: permission.error };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("branch_id, shop_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { error: "Aap ka khata band hai." };

  const shopId = String(formData.get("shop_id") ?? "").trim();
  if (!shopId) return { error: "Shop chunein — shaam ka hisaab isi se banta hai." };
  if (!permission.caller.unrestricted && (permission.caller.scope === "own_shop" || permission.caller.scope === "own_records")) {
    const ownShop = await staffShop(supabase, user.id, me.shop_id);
    if (!ownShop || ownShop !== shopId) return { error: "Sirf apni assigned shop ya active POS counter par entry karein." };
  }

  const accountId = String(formData.get("account_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "load").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const principal = paisa(formData.get("principal"));
  let serviceCharge = paisa(formData.get("service_charge"));
  // 0 = fee nahi li. Constraint sirf NULL ya >0 allow karti hai.
  if (serviceCharge === 0) serviceCharge = null;
  const method = String(formData.get("payment_method") ?? "cash").trim();
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim() || null;
  const rawPartyType = String(formData.get("party_type") ?? "").trim();
  const partyType = rawPartyType === "farmer" ? "farmer" as const : rawPartyType === "customer" ? "customer" as const : null;
  const partyId = String(formData.get("party_id") ?? "").trim() || null;
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
  if (serviceCharge !== null && serviceCharge < 0) {
    return { error: "Service charge manfi nahi ho sakta. Extra nahi liya to khana khali chhorein ya 0 likhein." };
  }

  const service = createServiceClient();
  const { data: shop } = await service.from("shops").select("id, branch_id, is_active").eq("id", shopId).maybeSingle();
  if (!shop?.is_active) return { error: "Shop active nahi ya record nahi mila." };
  if (!permission.caller.unrestricted && me.branch_id && shop.branch_id !== me.branch_id) return { error: "Sirf apni branch ki shop par entry karein." };


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
      p_upto: undefined,
    });
    if (balErr) {
      return { error: `Float ka balance parha nahi ja saka: ${balErr.message}` };
    }
    // NULL = asal khata juRa hi nahi -- us ko sifar samajh kar rok lagana
    // ghalat paighaam deta ("float kam hai"), jabke masla ye hai ke khata
    // chuna hi nahi gaya.
    if (balance === null || balance === undefined) {
      return {
        error: "Is provider account ke saath koi asal khata juRa nahi (jaise CBA Account). Pehle 'Float aur account' par ja kar us ka khata chunein.",
      };
    }
    const available = Number(balance);
    if (available < principal) {
      return {
        error: `Is account mein sirf Rs ${available.toLocaleString()} float hai — Rs ${principal.toLocaleString()} ka kaam nahi ho sakta. Pehle float mein paisa daalein.`,
      };
    }
  }

  const branchId = shop.branch_id ?? me.branch_id ?? account.branch_id ?? null;
  const total = Math.round((principal + (serviceCharge ?? 0)) * 100) / 100;

  const received = await receivingLine(
    method,
    total,
    financeAccountId,
    partyType,
    partyId,
    `${kind === "bill" ? "Bill" : "Load"} — ${reference}`
  );
  if ("error" in received) return { error: received.error };

  const txnNumber = await service.rpc("fn_next_load_number", { p_kind: kind });
  const number = String(txnNumber.data ?? "");
  if (!number) return { error: "Qatar ka number nahi ban saka." };

  // Provider qatar par chuna jata hai, account se nahi.
  //
  // Malik ka CBA account HAR provider ke liye ek hi hai (332) -- Jazz ka
  // load bhi wahin se, bijli ka bill bhi wahin se. Is liye "kis network
  // ka load gaya" ek alag sawal hai, aur us ka jawab har qatar par
  // chahiye. Jin accounts ka apna provider darj ho (sirf ek network ka
  // account), wahan wo khud bhar jata hai.
  const providerId =
    String(formData.get("provider_id") ?? "").trim() ||
    ((account.provider_id as string | null) ?? "");

  if (!providerId) {
    return { error: "Provider chunein — kis network ka load hai (ya kis qism ka bill)." };
  }

  const guess = await commissionGuess(providerId, kind, principal);

  const sourceRow = {
      txn_number: number,
      account_id: accountId,
      provider_id: providerId,
      kind,
      bill_category: billCategory,
      reference,
      principal,
      service_charge: serviceCharge,
      commission_expected: guess,
      commission_status: "muntazir",
      payment_method: method,
      finance_account_id: financeAccountId,
      customer_id: partyType === "customer" ? partyId : null,
      farmer_id: partyType === "farmer" ? partyId : null,
      customer_name: customerName,
      provider_tid: providerTid,
      // Saboot laga hua ho to seedha darj; warna qatar khud kehti hai ke
      // us par saboot baqi hai.
      status: providerTid ? "darj" : "saboot_baqi",
      float_settled: settled,
      branch_id: branchId,
      shop_id: shopId,
      created_by: user.id,
  };
  // Asal raqam AAMDANI NAHI hai -- wo customer ka paisa hai jo provider
  // tak ja raha hai. Aamdani sirf service charge hai. Commission yahan
  // nahi aati: wo statement ki tasdeeq ke baad aati hai.
  const floatGl = await loadAccountGl(accountId);
  if (settled && !floatGl) {
    return {
      error: "Is provider account ke saath koi asal khata juRa nahi (jaise CBA Account). Pehle 'Float aur account' par ja kar us ka khata chunein.",
    };
  }

  const lines: JournalLine[] = [received];
  lines.push(
    settled
      ? {
          account: floatGl as string,
          credit: principal,
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

  const cashBook: CashBookQatar[] = [];
  const aayaKahan = receivingCashBook(method, financeAccountId);
  if (aayaKahan) {
    cashBook.push({
      ...aayaKahan,
      amount: total,
      rukh: "aaya",
      category: kind === "bill" ? "bill_payment" : "mobile_load",
      notes: `${number} — ${reference}`,
      createdBy: user.id,
    });
  }
  if (settled) {
    const floatKhata = await loadAccountFinanceId(accountId);
    if (floatKhata) {
      cashBook.push({
        accountId: floatKhata,
        amount: principal,
        rukh: "gaya",
        category: kind === "bill" ? "bill_payment" : "mobile_load",
        notes: `${number} — ${reference} (float se gaya)`,
        createdBy: user.id,
        });
    }
  }
  const posted = await postDeskTransaction({
    description: `${kind === "bill" ? "Bill payment" : "Mobile load"} ${number} — ${reference}`,
    sourceModule: "load_bill",
    branchId,
    createdBy: user.id,
    lines,
    clientActionId: String(formData.get("client_action_id") ?? "").trim() || null,
  }, cashBook, { table: "load_transactions", row: sourceRow });
  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  // Staff apne dashboard (ghanti) par yehi transaction foran dekhe --
  // Malik ka Staff Sales Desk ka usool (16 September): "transaction
  // save hote hi logged-in staff ke naam notification create hoti hai."
  await notifyUser(
    user.id,
    kind === "bill" ? "Bill Payment darj" : "Mobile Load darj",
    `${number} — ${reference} — Rs ${total.toLocaleString()}`,
    "/admin/load-bill"
  );

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/pos");
  revalidatePath("/admin/crm");
  return {
    success: true,
    txnNumber: number,
    notice: providerTid
      ? `${number} darj ho gaya.`
      : `${number} darj ho gaya — magar provider ki TID abhi nahi lagi. Jab tak wo na lage, is qatar par "saboot baqi" likha rahega.`,
  };
}

/**
 * Customer cash/account se paisa deta hai aur hum apne bank/wallet se
 * us ke beneficiary ko transfer karte hain. Principal sirf asset-to-asset
 * movement hai; aamdani sirf service charge hai.
 */
export async function createBankTransfer(_prev: LoadState, formData: FormData): Promise<LoadState> {
  const permission = await requireAction("load-bill", "create");
  if ("error" in permission) return { error: permission.error };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("branch_id, shop_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { error: "Aap ka khata band hai." };

  const direction = String(formData.get("direction") ?? "sending");
  if (!["sending", "receiving"].includes(direction)) return { error: "Sending ya Receiving chunein." };
  const isReceiving = direction === "receiving";
  const sourceId = String(formData.get("source_finance_account_id") ?? "").trim();
  const receivedIn = String(formData.get("received_in") ?? "cash").trim();
  const destinationChannel = String(formData.get("destination_channel") ?? "").trim();
  const beneficiaryTitle = String(formData.get("beneficiary_title") ?? "").trim();
  const beneficiaryAccount = String(formData.get("beneficiary_account") ?? "").replace(/\s+/g, "").trim();
  const principal = paisa(formData.get("principal"));
  let serviceCharge = paisa(formData.get("service_charge"));
  // 0 = fee nahi li. Constraint sirf NULL ya >0 allow karti hai.
  if (serviceCharge === 0) serviceCharge = null;
  const providerTid = String(formData.get("provider_tid") ?? "").trim() || null;