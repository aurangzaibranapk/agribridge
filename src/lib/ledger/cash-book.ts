import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/types/database.types";
import { aajKaKhana } from "@/lib/utils/format";

/**
 * Cash Book ki qatar -- ledger ke SAATH, us ke baad nahi.
 *
 * =====================================================================
 * YE FILE KYUN BANI
 * =====================================================================
 *
 * Is system mein paise ke DO register hain, aur dono ka kaam alag hai:
 *
 *   * **Ledger** (`journal_lines`) -- har rupya do rukh se. Trial
 *     Balance, P&L, Chart of Accounts sab yahin se bante hain.
 *   * **Cash Book** (`finance_transactions`) -- har khate ki apni
 *     qatarein. `finance_accounts.current_balance` SIRF yahan se nikalta
 *     hai (127 se, aur `fn_guard_finance_balance` us par taala bhi lagata
 *     hai -- balance haath se likha hi nahi ja sakta).
 *
 * Matlab ye ke jo kaam sirf ledger mein jaye, wo Finance ke safhe par
 * nazar hi nahi aata. Kitab barabar rehti hai, phir bhi khate ka adad
 * ghalat rehta hai -- aur wohi adad malik screen par parhte hain.
 *
 * 6 September ko yehi hua. Do raaste ledger-only the:
 *
 *   1. Khate se khate mein raqam le jana (`transferAccountBalance`)
 *   2. Load / bill ki qatar (`createLoadTransaction`)
 *
 * Nateeja: Finance ka safha Bank Alfalah par Rs 7,165 dikha raha tha jab
 * ke ledger ke mutabiq Rs 5,165 the (Rs 2,000 CBA mein ja chuke the),
 * aur Easypaisa par Rs 0 jab ke ledger par Rs 1,020 the.
 *
 * =====================================================================
 * `current_balance` KO SEEDHA LEDGER SE KYUN NAHI NIKALTE
 * =====================================================================
 *
 * Ye zyada saaf lagta hai, magar aaj ke system mein ghalat hai: bees se
 * zyada jagah aisi hain jo Cash Book mein qatar daalti hain. Un sab ka
 * ledger se juRa hona pehle sabit karna paRega. Jab tak wo jaanch na ho,
 * `current_balance` ka source badalna us paise ko ghayab kar sakta hai
 * jo sirf Cash Book mein darj hai.
 *
 * Is liye qaida wohi rehta hai jo 127 ne rakha tha -- Cash Book se
 * balance -- aur jo raaste use chhorte the, wo yahan se theek hote hain.
 */

export type CashBookRukh = "aaya" | "gaya";

export interface CashBookQatar {
  /** Khata -- ya to us ki id, ya us ka GL code. Ek zaroori hai. */
  accountId?: string | null;
  glCode?: string | null;
  amount: number;
  rukh: CashBookRukh;
  category: string;
  notes: string;
  tareekh?: string;
  createdBy?: string | null;
}

/**
 * GL code se finance account.
 *
 * Ek se zyada khate ek hi GL code par hon to JAAN BOOJH KAR koi qatar
 * nahi banti. Andaza laga kar kisi ek par daal dena us khate ka balance
 * ghalat kar deta -- aur ye wo qism ki ghalti hai jo mahine baad, bank
 * se milan karte waqt, nikalti hai.
 */
async function khataGlSe(glCode: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("finance_accounts")
    .select("id")
    .eq("gl_code", glCode);
  if (!data || data.length !== 1) return null;
  return data[0].id as string;
}

/**
 * Ek ya zyada qatarein Cash Book mein.
 *
 * Jo qatar kisi finance account par nahi baithti (jaise 2040 "Wallet ka
 * bojh" ya 1100 "Customer se lena") wo CHUP CHAAP chhoR di jati hai --
 * wo khata Cash Book ka hai hi nahi. Ye khamoshi theek hai: Cash Book
 * sirf cash aur bank ke khaton ki kitab hai.
 *
 * Jawab batata hai ke kitni qatarein bani. Bulane wala chahe to gin le.
 */
export async function cashBookLikhein(
  qatarein: CashBookQatar[]
): Promise<{ likhi: number; error?: string }> {
  const service = createServiceClient();
  const rows: Database["public"]["Tables"]["finance_transactions"]["Insert"][] = [];

  for (const q of qatarein) {
    if (!Number.isFinite(q.amount) || q.amount <= 0) continue;

    let accountId = q.accountId ?? null;
    if (!accountId && q.glCode) accountId = await khataGlSe(q.glCode);
    if (!accountId) continue;

    rows.push({
      account_id: accountId,
      transaction_type: q.rukh === "aaya" ? "income" : "expense",
      category: q.category,
      amount: Math.round(q.amount * 100) / 100,
      transaction_date: q.tareekh ?? aajKaKhana(),
      notes: q.notes,
      created_by: q.createdBy ?? null,
    });
  }

  if (rows.length === 0) return { likhi: 0 };

  const { error } = await service.from("finance_transactions").insert(rows);
  if (error) return { likhi: 0, error: error.message };
  return { likhi: rows.length };
}

/**
 * Qatar ulti karna.
 *
 * Mitai nahi jati. Wohi usool jo ledger mein hai: ghalti ke sath us ka
 * nishan bhi chala jaye to phir koi nahi bata sakta ke us din kaam hua
 * tha ya nahi. Is liye ULTI qatar banti hai, aur dono nazar aati hain.
 */
export async function cashBookUlti(
  qatarein: CashBookQatar[]
): Promise<{ likhi: number; error?: string }> {
  return cashBookLikhein(
    qatarein.map((q) => ({ ...q, rukh: q.rukh === "aaya" ? "gaya" : "aaya" }))
  );
}
