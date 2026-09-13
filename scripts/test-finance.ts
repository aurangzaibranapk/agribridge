/**
 * Maali jaanch -- asal code ke raaste se.
 *
 * Ye script wahi raasta chalati hai jo app chalati hai: postCashIn,
 * postCashOut, reverseJournal. Aur har qadam par ek hi sawal poochhti
 * hai -- "tawaqqo kya thi, hua kya".
 *
 * Alag script is liye ke database par SQL chala kar dekh lena kaafi
 * nahi tha: wahan sirf trigger jaancha jata hai, wo code nahi jo trigger
 * ko bulata hai. Dohri ginti ka masla bhi code hi mein tha, trigger mein
 * nahi.
 *
 * Chalane ka tareeqa:
 *
 *     npm run test:finance
 *
 * Ye .env.development.local se chaabi uthati hai, yani TESTING wale
 * nizaam par chalti hai. Live par mat chalayein: ye khate aur qatarein
 * banati hai (aur aakhir mein khud saaf kar deti hai, magar "khud saaf
 * kar deti hai" par live par bharosa nahi karna chahiye).
 */
// Next ka apna env loader. dotenv alag se lagane ki zaroorat nahi -- aur
// isi ki tarteeb Next chalata hai, yani .env.development.local wahi
// tarjeeh paata hai jo `npm run dev` par milti hai. Do alag loader
// rakhne ka matlab hota: kabhi test testing wale nizaam par chalta,
// kabhi live par.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database.types";

const TAG = "ZZTEST";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ya SUPABASE_SERVICE_ROLE_KEY nahi mili.");
  console.error("Ye .env.development.local mein honi chahiye.");
  process.exit(1);
}
const db = createClient<Database>(url, key, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;

function check(step: string, expected: number, actual: number) {
  const ok = Math.abs(expected - actual) < 0.005;
  if (ok) pass += 1;
  else fail += 1;
  console.log(
    `${ok ? "  THEEK " : "  GHALAT"}  ${step.padEnd(38)} tawaqqo ${String(expected).padStart(10)}  |  hua ${String(actual).padStart(10)}`
  );
}

function checkText(step: string, expected: string, actual: string) {
  const ok = expected === actual;
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "  THEEK " : "  GHALAT"}  ${step.padEnd(38)} tawaqqo ${expected}  |  hua ${actual}`);
}

async function balance(accountId: string): Promise<number> {
  const { data } = await db.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  return Number(data?.current_balance ?? NaN);
}

async function cleanup() {
  const { data: accounts } = await db.from("finance_accounts").select("id").ilike("name", `${TAG}%`);
  const ids = (accounts ?? []).map((a) => a.id);
  if (ids.length === 0) return;

  const { data: txns } = await db.from("finance_transactions").select("id").in("account_id", ids);
  const txnIds = (txns ?? []).map((t) => t.id);
  if (txnIds.length > 0) {
    await db.from("journal_entry_sources").delete().in("source_row_id", txnIds);
    await db.from("finance_transactions").delete().in("id", txnIds);
  }

  const { data: entries } = await db.from("journal_entries").select("id").ilike("description", `${TAG}%`);
  const entryIds = (entries ?? []).map((e) => e.id);
  if (entryIds.length > 0) {
    await db.from("journal_entry_sources").delete().in("entry_id", entryIds);
    await db.from("journal_lines").delete().in("entry_id", entryIds);
    // Reversal pehle: wo asal entry ki taraf ishara karti hai.
    await db.from("journal_entries").delete().in("id", entryIds).eq("is_reversal", true);
    await db.from("journal_entries").delete().in("id", entryIds);
  }

  await db.from("finance_accounts").delete().in("id", ids);
}

async function main() {
  console.log("\nMaali jaanch — cash book aur ledger\n");
  await cleanup();

  const { postCashIn, postCashOut, failed } = await import("../src/lib/ledger/rules");
  const { reverseJournal } = await import("../src/lib/ledger/post");

  const { data: cash } = await db
    .from("finance_accounts")
    .insert({ name: `${TAG} Cash`, account_type: "cash", opening_balance: 10000 })
    .select("id")
    .single();
  const { data: bank } = await db
    .from("finance_accounts")
    .insert({ name: `${TAG} Bank`, account_type: "bank", opening_balance: 50000 })
    .select("id")
    .single();
  if (!cash || !bank) throw new Error("Test ke khate nahi ban sake.");

  check("khulne ki raqam", 10000, await balance(cash.id));

  // ---- KHARCHA ----
  // Har waqia DO jagah likha jata hai: cash book (finance_transactions)
  // aur ledger. Yehi wo jagah thi jahan balance dobara hilaya jata tha.
  const { data: exp } = await db
    .from("finance_transactions")
    .insert({ account_id: cash.id, transaction_type: "expense", category: `${TAG} kharcha`, amount: 1000 })
    .select("id")
    .single();
  const expPost = await postCashOut({
    accountId: cash.id,
    amount: 1000,
    description: `${TAG} bardana ka kharcha`,
    ctx: { createdBy: null, claims: [{ table: "finance_transactions", rowId: exp!.id }] },
  });
  if (failed(expPost)) throw new Error(`Kharcha ledger mein nahi gaya: ${expPost.error}`);
  check("kharcha 1000", 9000, await balance(cash.id));

  // ---- AAMDANI ----
  const { data: inc } = await db
    .from("finance_transactions")
    .insert({ account_id: cash.id, transaction_type: "income", category: `${TAG} aamdani`, amount: 2500 })
    .select("id")
    .single();
  const incPost = await postCashIn({
    accountId: cash.id,
    amount: 2500,
    description: `${TAG} bikri ka paisa`,
    ctx: { createdBy: null, claims: [{ table: "finance_transactions", rowId: inc!.id }] },
  });
  if (failed(incPost)) throw new Error(`Aamdani ledger mein nahi gayi: ${incPost.error}`);
  check("aamdani 2500", 11500, await balance(cash.id));

  // ---- TRANSFER: ek waqia, do qatarein ----
  const { data: out } = await db
    .from("finance_transactions")
    .insert({ account_id: cash.id, transaction_type: "transfer_out", category: `${TAG} transfer`, amount: 5000 })
    .select("id")
    .single();
  await db.from("finance_transactions").insert({
    account_id: bank.id,
    transaction_type: "transfer_in",
    category: `${TAG} transfer`,
    amount: 5000,
    related_transfer_id: out!.id,
  });
  check("transfer nikla 5000", 6500, await balance(cash.id));
  check("transfer aaya 5000", 55000, await balance(bank.id));

  // ---- ADHOORI ADAIGI: Rs 3,000 ka bill, do qiston mein ----
  for (const [i, amount] of [1200, 1800].entries()) {
    const { data: row } = await db
      .from("finance_transactions")
      .insert({ account_id: cash.id, transaction_type: "income", category: `${TAG} qist`, amount })
      .select("id")
      .single();
    const posted = await postCashIn({
      accountId: cash.id,
      amount,
      description: `${TAG} qist ${i + 1}`,
      ctx: { createdBy: null, claims: [{ table: "finance_transactions", rowId: row!.id }] },
    });
    if (failed(posted)) throw new Error(`Qist ${i + 1} ledger mein nahi gayi: ${posted.error}`);
    check(`adhoori adaigi — qist ${i + 1} (${amount})`, i === 0 ? 7700 : 9500, await balance(cash.id));
  }

  // ---- WOHI TRANSACTION DOBARA ----
  // Cash book jaan boojh kar do ek jaise kharche qubool karta hai: ek hi
  // din do baar Rs 1,000 ka bardana lena mumkin hai. Rok us jagah hai jo
  // asal mein ahem hai -- LEDGER ke daawe par: ek hi qatar do entriyon
  // mein nahi gin'ni chahiye.
  const { data: dup } = await db
    .from("finance_transactions")
    .insert({ account_id: cash.id, transaction_type: "expense", category: `${TAG} kharcha`, amount: 1000 })
    .select("id")
    .single();
  check("wohi kharcha dobara", 8500, await balance(cash.id));

  const dupClaim = await postCashOut({
    accountId: cash.id,
    amount: 1000,
    description: `${TAG} wohi qatar dobara`,
    ctx: { createdBy: null, claims: [{ table: "finance_transactions", rowId: exp!.id }] },
  });
  checkText(
    "purani qatar par dobara daawa",
    "rok diya gaya",
    failed(dupClaim) ? "rok diya gaya" : "qubool ho gaya"
  );
  await db.from("finance_transactions").delete().eq("id", dup!.id);
  check("dobara wala kharcha mitaya", 9500, await balance(cash.id));

  // ---- REVERSAL ----
  // Reversal purani entry ko chhoota nahi -- us ke ulat nayi entry banata
  // hai. 127 se wo cash book ko bhi ulta karta hai; pehle sirf ledger
  // ulatta tha aur do kitabein alag ho jati thin.
  const reversed = await reverseJournal(
    (expPost as { id: string }).id,
    `${TAG} ghalat khate mein daal diya tha`,
    null
  );
  if ("error" in reversed) throw new Error(`Reversal nahi hua: ${reversed.error}`);
  check("reversal ke baad (kharcha wapas)", 10500, await balance(cash.id));

  // ---- DONO KITABEIN BARABAR ----
  const { data: drift } = await db.from("v_finance_balance_check").select("account_name");
  check("farq ki fehrist (khali honi chahiye)", 0, (drift ?? []).length);

  await cleanup();

  console.log(`\n${pass} theek, ${fail} ghalat\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nJaanch beech mein ruk gayi:", e instanceof Error ? e.message : e);
  await cleanup();
  process.exit(1);
});
