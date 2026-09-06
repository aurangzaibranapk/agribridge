"use server";

import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC, glForFinanceAccount } from "@/lib/ledger/rules";
import { cashBookLikhein } from "@/lib/ledger/cash-book";
import { logAudit } from "@/lib/audit";

/**
 * Customer ka udhaar -- dukan se paisa lena, aur wapas karna.
 *
 * =====================================================================
 * YE KYUN BANA
 * =====================================================================
 *
 * Malik (6 September):
 *
 *   *"ek customer dukan se paise udhaar le gaya hai 5,000 -- wo kis
 *   tarah kahan darj karun mujhe batao."*
 *
 * Aur phir:
 *
 *   *"customer ke bana dein, POS ke upar jahan hum load bill kar rahe
 *   hain wahan udhaar raqam bhi karein -- wo customer ke ledger mein
 *   jaye, har jagah wo balance jayega, aur jab customer wo hamein wapas
 *   dega to wo bhi indraj hona chahiye ke aaj aaya hai."*
 *
 * Us waqt is ka koi raasta nahi tha. Khata sirf BIKRI par banta tha
 * (POS ki "khata" wali adaigi). Naqad paisa udhaar dene ka koi khana hi
 * nahi tha -- aur wo dukan par roz hota hai.
 *
 * =====================================================================
 * YE BIKRI NAHI HAI
 * =====================================================================
 *
 * Ye farq ahem hai. Udhaar dene par:
 *
 *   * koi maal nahi gaya, is liye **koi aamdani nahi banti** aur COGS
 *     bhi nahi. Ise bikri likh dena mahine ka nafa jhoota kar deta.
 *   * sirf paisa shakl badalta hai: golak/bank se nikal kar "Customer
 *     se lena" (1100) ban gaya.
 *
 * Wapsi us ka ulta hai. Dono baar teen jagah ek sath hilti hain:
 *
 *   1. **Ledger** -- 1100 par party ke sath qatar (statement yahin se
 *      banta hai)
 *   2. **Cash Book** -- jis khate se paisa gaya ya aaya
 *   3. **Customer ka balance** -- `customers.current_balance`, wohi adad
 *      jo POS par counter pe nazar aata hai aur credit limit rokti hai
 *
 * Teenon ek sath na hon to teen alag sach ban jate hain -- aur is
 * project mein wo pehle bhi ho chuka hai (127, 139).
 */

export interface UdhaarState {
  error?: string;
  success?: boolean;
  notice?: string;
}

function paisa(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Naqad udhaar dena aur wapas lena -- dono baRe faisle hain. */
const UDHAAR_ROLES = ["owner", "super_admin", "admin", "finance", "manager"];

async function darwaza() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Pehle login karein." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return { ok: false as const, error: "Aap ka khata band hai." };
  if (!UDHAAR_ROLES.includes(me.role)) {
    return {
      ok: false as const,
      error: "Naqad udhaar dena ya wapas lena sirf Manager, Finance ya Admin ka kaam hai.",
    };
  }
  return { ok: true as const, userId: user.id, branchId: (me.branch_id as string | null) ?? null };
}

/**
 * Customer dukan se naqad paisa udhaar le gaya.
 */
export async function giveCustomerLoan(_prev: UdhaarState, formData: FormData): Promise<UdhaarState> {
  const g = await darwaza();
  if (!g.ok) return { error: g.error };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const rakam = paisa(formData.get("rakam"));
  // "cash" ya kisi finance account ki id.
  const kahanSe = String(formData.get("kahan_se") ?? "cash").trim();
  const wajah = String(formData.get("wajah") ?? "").trim();
  const tareekh = String(formData.get("tareekh") ?? "").trim() || aajKaKhana();

  if (!customerId) return { error: "Customer chunein — kis ko paisa diya." };
  if (rakam === null || rakam <= 0) {
    return { error: "Raqam likhein — sifar ka udhaar nahi hota." };
  }

  const service = createServiceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id, name, current_balance, credit_limit")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: "Customer nahi mila." };

  // Hadd ki rok -- magar sirf wahan jahan hadd WAQAI darj hai.
  //
  // `credit_limit` NULL ka matlab hai "hadd tay hi nahi hui", "hadd
  // sifar hai" nahi. Us ko sifar samajh kar rok laga dena har customer
  // ko udhaar se rok deta, aur wo faisla kisi ne kiya hi nahi.
  const abTak = customer.current_balance == null ? 0 : Number(customer.current_balance);
  const hadd = customer.credit_limit == null ? null : Number(customer.credit_limit);
  if (hadd !== null && abTak + rakam > hadd) {
    return {
      error: `${customer.name} ki udhaar ki hadd Rs ${hadd.toLocaleString()} hai. Abhi Rs ${abTak.toLocaleString()} chal raha hai — Rs ${rakam.toLocaleString()} aur dene se hadd toot jayegi.`,
    };
  }

  const naqad = kahanSe === "cash";
  const gl = naqad ? ACC.cash : await glForFinanceAccount(kahanSe);
  if (gl === ACC.suspense) {
    return { error: "Paisa kis khate se gaya — wo khata dobara chunein." };
  }

  const tafseel = `Naqad udhaar — ${customer.name}${wajah ? ` (${wajah})` : ""}`;

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "customer_udhaar",
    sourceId: customerId,
    entryDate: tareekh,
    branchId: g.branchId,
    createdBy: g.userId,
    lines: [
      {
        account: ACC.customerDue,
        debit: rakam,
        partyType: "customer",
        partyId: customerId,
        memo: tafseel,
      },
      { account: gl, credit: rakam, memo: tafseel },
    ],
  });
  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  const cb = await cashBookLikhein([
    {
      ...(naqad ? { glCode: ACC.cash } : { accountId: kahanSe }),
      amount: rakam,
      rukh: "gaya",
      category: "customer_udhaar",
      notes: tafseel,
      tareekh,
      createdBy: g.userId,
    },
  ]);
  if (cb.error) {
    return {
      error: `Entry ${posted.entryNumber} ledger mein ban gayi, magar Cash Book mein qatar nahi bani: ${cb.error}. Ye farq theek karwa lein — warna khate ka balance ghalat rahega.`,
    };
  }

  await service
    .from("customers")
    .update({ current_balance: Math.round((abTak + rakam) * 100) / 100 })
    .eq("id", customerId);

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: customerId,
    recordLabel: customer.name ?? "Customer",
    description: `Naqad udhaar diya: Rs ${rakam.toLocaleString()} — ${customer.name}${wajah ? ` (${wajah})` : ""} (${posted.entryNumber})`,
  });

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/finance");
  return {
    success: true,
    notice: `Rs ${rakam.toLocaleString()} ${customer.name} ke khate par chaRh gaye. Ab un ka baqi Rs ${(abTak + rakam).toLocaleString()} hai.`,
  };
}

/**
 * Customer ne udhaar wapas kiya.
 *
 * Malik: *"jab customer wo hamein wapas dega to wo bhi indraj hona
 * chahiye ke aaj aaya hai."*
 */
export async function takeCustomerRepayment(_prev: UdhaarState, formData: FormData): Promise<UdhaarState> {
  const g = await darwaza();
  if (!g.ok) return { error: g.error };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const rakam = paisa(formData.get("rakam"));
  const kahanAaya = String(formData.get("kahan_aaya") ?? "cash").trim();
  const wajah = String(formData.get("wajah") ?? "").trim();
  const tareekh = String(formData.get("tareekh") ?? "").trim() || aajKaKhana();

  if (!customerId) return { error: "Customer chunein — kis ne paisa diya." };
  if (rakam === null || rakam <= 0) return { error: "Raqam likhein." };

  const service = createServiceClient();
  const { data: customer } = await service
    .from("customers")
    .select("id, name, current_balance")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: "Customer nahi mila." };

  const abTak = customer.current_balance == null ? 0 : Number(customer.current_balance);

  // Jitna dena hi nahi, us se zyada wapas lena rok diya jata hai.
  //
  // Wo qatar customer ka balance MANFI kar deti hai, aur manfi baqi ka
  // matlab hai "dukan us ka paisa daabe baithi hai" -- aur wo baat aksar
  // ghalat hoti hai; asal wajah ye hoti hai ke kisi aur customer ki
  // raqam ghalti se is par lag gayi. Waqai advance lena ho to wo alag
  // cheez hai aur us ka apna khana hai.
  if (rakam - abTak > 0.005) {
    return {
      error: `${customer.name} par sirf Rs ${abTak.toLocaleString()} ka udhaar hai — us se zyada wapsi darj nahi hoti. Raqam dobara dekh lein.`,
    };
  }

  const naqad = kahanAaya === "cash";
  const gl = naqad ? ACC.cash : await glForFinanceAccount(kahanAaya);
  if (gl === ACC.suspense) {
    return { error: "Paisa kis khate mein aaya — wo khata dobara chunein." };
  }

  const tafseel = `Udhaar ki wapsi — ${customer.name}${wajah ? ` (${wajah})` : ""}`;

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "customer_udhaar",
    sourceId: customerId,
    entryDate: tareekh,
    branchId: g.branchId,
    createdBy: g.userId,
    lines: [
      { account: gl, debit: rakam, memo: tafseel },
      {
        account: ACC.customerDue,
        credit: rakam,
        partyType: "customer",
        partyId: customerId,
        memo: tafseel,
      },
    ],
  });
  if ("error" in posted) return { error: `Ledger mein darj nahi ho saka: ${posted.error}` };

  const cb = await cashBookLikhein([
    {
      ...(naqad ? { glCode: ACC.cash } : { accountId: kahanAaya }),
      amount: rakam,
      rukh: "aaya",
      category: "customer_udhaar_wapsi",
      notes: tafseel,
      tareekh,
      createdBy: g.userId,
    },
  ]);
  if (cb.error) {
    return {
      error: `Entry ${posted.entryNumber} ledger mein ban gayi, magar Cash Book mein qatar nahi bani: ${cb.error}. Ye farq theek karwa lein.`,
    };
  }

  await service
    .from("customers")
    .update({ current_balance: Math.round((abTak - rakam) * 100) / 100 })
    .eq("id", customerId);

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: customerId,
    recordLabel: customer.name ?? "Customer",
    description: `Udhaar wapas aaya: Rs ${rakam.toLocaleString()} — ${customer.name}${wajah ? ` (${wajah})` : ""} (${posted.entryNumber})`,
  });

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/finance");
  return {
    success: true,
    notice:
      abTak - rakam < 0.005
        ? `Rs ${rakam.toLocaleString()} aa gaye. ${customer.name} ka khata ab saaf hai.`
        : `Rs ${rakam.toLocaleString()} aa gaye. ${customer.name} par ab Rs ${(abTak - rakam).toLocaleString()} baqi hain.`,
  };
}
