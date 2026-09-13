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
  return { ok: true as const, userId: user.id, branchId: (me.branch_id as string | null) ?? null, supabase };
}

/**
 * Kisi bande ka poora khulasa — Lena, Dena, Net — form ke andar hi
 * dikhane ke liye.
 *
 * Malik (7 September): *"Customer select hote hi form ke andar ek
 * compact strip aa jaye... Staff ko doosra page kholne ki zarurat
 * nahi."*
 *
 * Ye sirf DEKHNE ke liye hai, isi liye `giveCustomerLoan` wale role ka
 * taala yahan nahi -- koi bhi staff bande ka khulasa dekh sakta hai,
 * udhaar dena/lena alag ijazat hai.
 */
export async function bandeKaKhulasaDekhein(
  partyType: "customer" | "farmer",
  partyId: string
): Promise<{ lena: number; dena: number } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const loose = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { lena: number; dena: number }[] | null; error: unknown }>;
  };
  const { data, error } = await loose.rpc("fn_bande_ka_khulasa", { p_party_type: partyType, p_party_id: partyId });
  if (error) return { error: "Khulasa nahi mil saka." };

  const rows = data ?? [];
  return {
    lena: Math.round(rows.reduce((s, r) => s + Number(r.lena ?? 0), 0) * 100) / 100,
    dena: Math.round(rows.reduce((s, r) => s + Number(r.dena ?? 0), 0) * 100) / 100,
  };
}

/**
 * Kisan ka abhi ka baqi (account 1150, ACC.farmerDue) — `fn_bande_ka_khulasa`
 * se. Ye service client se nahi chalta (SECURITY DEFINER andar
 * `fn_is_any_staff()` poochta hai), is liye logged-in bande ka
 * `supabase` client chahiye.
 */
async function farmerKaAbhiKaBaqi(
  supabase: ReturnType<typeof createClient>,
  farmerId: string
): Promise<number> {
  // `fn_bande_ka_khulasa` migration 348 mein bani -- generated types
  // abhi taza nahi huyin, is liye rpc() ka apna type is naye function
  // ko nahi jaanta. Wohi tareeqa jo banda-khata safhe (348) mein hai.
  const loose = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { khata_code: string; dena: number }[] | null; error: unknown }>;
  };
  const { data } = await loose.rpc("fn_bande_ka_khulasa", { p_party_type: "farmer", p_party_id: farmerId });
  const row = (data ?? []).find((r) => r.khata_code === ACC.farmerDue);
  return row ? Number(row.dena ?? 0) : 0;
}

/**
 * Customer ya kisan, dukan se naqad paisa udhaar le gaya.
 *
 * Malik (7 September): Load & Bill ka udhaar sirf dukan ke customer
 * tak mehdood nahi — kisan ko bhi naqad udhaar milta hai. Account aur
 * balance ka raasta har type ka apna hai (customer: `customers` table
 * ka `current_balance`; kisan: koi alag column nahi, us ka baqi hamesha
 * ledger se — 1150 par `fn_bande_ka_khulasa`), magar journal/cash-book
 * ka tareeqa bilkul wohi hai.
 */
export async function giveCustomerLoan(_prev: UdhaarState, formData: FormData): Promise<UdhaarState> {
  const g = await darwaza();
  if (!g.ok) return { error: g.error };

  const partyType = String(formData.get("party_type") ?? "").trim();
  const partyId = String(formData.get("party_id") ?? "").trim();
  const rakam = paisa(formData.get("rakam"));
  // "cash" ya kisi finance account ki id.
  const kahanSe = String(formData.get("kahan_se") ?? "cash").trim();
  const wajah = String(formData.get("wajah") ?? "").trim();
  const tareekh = String(formData.get("tareekh") ?? "").trim() || aajKaKhana();

  if (partyType !== "customer" && partyType !== "farmer") {
    return { error: "Customer ya kisan chunein — kis ko paisa diya." };
  }
  if (!partyId) return { error: "Customer ya kisan chunein — kis ko paisa diya." };
  if (rakam === null || rakam <= 0) {
    return { error: "Raqam likhein — sifar ka udhaar nahi hota." };
  }

  const service = createServiceClient();
  let name: string;
  let abTak: number;
  let hadd: number | null;
  const account = partyType === "customer" ? ACC.customerDue : ACC.farmerDue;

  if (partyType === "customer") {
    const { data: customer } = await service
      .from("customers")
      .select("id, name, current_balance, credit_limit")
      .eq("id", partyId)
      .maybeSingle();
    if (!customer) return { error: "Customer nahi mila." };
    name = customer.name ?? "Customer";
    abTak = customer.current_balance == null ? 0 : Number(customer.current_balance);
    hadd = customer.credit_limit == null ? null : Number(customer.credit_limit);
  } else {
    const { data: farmer } = await service
      .from("farmers")
      .select("id, full_name, farmer_code, credit_limit")
      .eq("id", partyId)
      .maybeSingle();
    if (!farmer) return { error: "Kisan nahi mila." };
    name = farmer.full_name ?? farmer.farmer_code;
    abTak = await farmerKaAbhiKaBaqi(g.supabase, partyId);
    hadd = farmer.credit_limit == null ? null : Number(farmer.credit_limit);
  }

  // Hadd ki rok -- magar sirf wahan jahan hadd WAQAI darj hai.
  //
  // `credit_limit` NULL ka matlab hai "hadd tay hi nahi hui", "hadd
  // sifar hai" nahi. Us ko sifar samajh kar rok laga dena har banday
  // ko udhaar se rok deta, aur wo faisla kisi ne kiya hi nahi.
  if (hadd !== null && abTak + rakam > hadd) {
    return {
      error: `${name} ki udhaar ki hadd Rs ${hadd.toLocaleString()} hai. Abhi Rs ${abTak.toLocaleString()} chal raha hai — Rs ${rakam.toLocaleString()} aur dene se hadd toot jayegi.`,
    };
  }

  const naqad = kahanSe === "cash";
  const gl = naqad ? ACC.cash : await glForFinanceAccount(kahanSe);
  if (gl === ACC.suspense) {
    return { error: "Paisa kis khate se gaya — wo khata dobara chunein." };
  }

  const tafseel = `Naqad udhaar — ${name}${wajah ? ` (${wajah})` : ""}`;

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "customer_udhaar",
    sourceId: partyId,
    entryDate: tareekh,
    branchId: g.branchId,
    createdBy: g.userId,
    lines: [
      {
        account,
        debit: rakam,
        partyType,
        partyId,
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

  // Kisan ka koi alag "balance" column nahi -- us ka baqi hamesha
  // ledger se ginta hai, is liye yahan update karne ko kuch nahi.
  if (partyType === "customer") {
    await service
      .from("customers")
      .update({ current_balance: Math.round((abTak + rakam) * 100) / 100 })
      .eq("id", partyId);
  }

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: partyId,
    recordLabel: name,
    description: `Naqad udhaar diya: Rs ${rakam.toLocaleString()} — ${name}${wajah ? ` (${wajah})` : ""} (${posted.entryNumber})`,
  });

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/farmer-credit");
  // Agar is bande ke paas pehle se credit tha (zyada wapsi se), to naya
  // udhaar khud usi credit mein se katta hai -- ledger ka apna hisaab,
  // alag se kuch adjust nahi karna parta.
  const abTakBaad = Math.round((abTak + rakam) * 100) / 100;
  return {
    success: true,
    notice:
      abTakBaad < -0.005
        ? `Rs ${rakam.toLocaleString()} ${name} ke khate par chaRh gaye. Purana credit isi mein se kat gaya — ab bhi Rs ${Math.abs(abTakBaad).toLocaleString()} credit baqi hai.`
        : `Rs ${rakam.toLocaleString()} ${name} ke khate par chaRh gaye. Ab un ka baqi Rs ${abTakBaad.toLocaleString()} hai.`,
  };
}

/**
 * Customer ya kisan ne udhaar wapas kiya.
 *
 * Malik: *"jab customer wo hamein wapas dega to wo bhi indraj hona
 * chahiye ke aaj aaya hai."* (7 September: kisan ke liye bhi.)
 */
export async function takeCustomerRepayment(_prev: UdhaarState, formData: FormData): Promise<UdhaarState> {
  const g = await darwaza();
  if (!g.ok) return { error: g.error };

  const partyType = String(formData.get("party_type") ?? "").trim();
  const partyId = String(formData.get("party_id") ?? "").trim();
  const rakam = paisa(formData.get("rakam"));
  const kahanAaya = String(formData.get("kahan_aaya") ?? "cash").trim();
  const wajah = String(formData.get("wajah") ?? "").trim();
  const tareekh = String(formData.get("tareekh") ?? "").trim() || aajKaKhana();

  if (partyType !== "customer" && partyType !== "farmer") {
    return { error: "Customer ya kisan chunein — kis ne paisa diya." };
  }
  if (!partyId) return { error: "Customer ya kisan chunein — kis ne paisa diya." };
  if (rakam === null || rakam <= 0) return { error: "Raqam likhein." };

  const service = createServiceClient();
  let name: string;
  let abTak: number;
  const account = partyType === "customer" ? ACC.customerDue : ACC.farmerDue;

  if (partyType === "customer") {
    const { data: customer } = await service
      .from("customers")
      .select("id, name, current_balance")
      .eq("id", partyId)
      .maybeSingle();
    if (!customer) return { error: "Customer nahi mila." };
    name = customer.name ?? "Customer";
    abTak = customer.current_balance == null ? 0 : Number(customer.current_balance);
  } else {
    const { data: farmer } = await service
      .from("farmers")
      .select("id, full_name, farmer_code")
      .eq("id", partyId)
      .maybeSingle();
    if (!farmer) return { error: "Kisan nahi mila." };
    name = farmer.full_name ?? farmer.farmer_code;
    abTak = await farmerKaAbhiKaBaqi(g.supabase, partyId);
  }

  // Malik (7 September): "System Rs900 ko gayab nahi karega aur payment
  // reject bhi nahi karega... Rs900 -> Customer Advance/Credit."
  //
  // Pehle yahan udhaar se zyada wapsi rok di jati thi — us waqt ka usool
  // ye tha ke zyada raqam aksar kisi AUR customer ki ghalti se lag jati
  // hai. Ab faisla ulat gaya: zyada aane wala paisa gum nahi hota, khud
  // isi khate mein CREDIT (manfi baqi) ban jata hai — agli udhaar ya
  // agla kharcha khud isi credit se pehle katega (1100/1150 ka net
  // balance jo bhi ho, wohi sach hai; koi alag "advance" table nahi
  // banai, warna do jagah paisa track hone lagta).
  const zyada = rakam - abTak > 0.005 ? Math.round((rakam - abTak) * 100) / 100 : 0;

  const naqad = kahanAaya === "cash";
  const gl = naqad ? ACC.cash : await glForFinanceAccount(kahanAaya);
  if (gl === ACC.suspense) {
    return { error: "Paisa kis khate mein aaya — wo khata dobara chunein." };
  }

  const tafseel = `Udhaar ki wapsi — ${name}${wajah ? ` (${wajah})` : ""}`;

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "customer_udhaar",
    sourceId: partyId,
    entryDate: tareekh,
    branchId: g.branchId,
    createdBy: g.userId,
    lines: [
      { account: gl, debit: rakam, memo: tafseel },
      {
        account,
        credit: rakam,
        partyType,
        partyId,
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

  // Kisan ka koi alag "balance" column nahi -- us ka baqi hamesha
  // ledger se ginta hai.
  if (partyType === "customer") {
    await service
      .from("customers")
      .update({ current_balance: Math.round((abTak - rakam) * 100) / 100 })
      .eq("id", partyId);
  }

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: partyId,
    recordLabel: name,
    description: `Udhaar wapas aaya: Rs ${rakam.toLocaleString()} — ${name}${wajah ? ` (${wajah})` : ""} (${posted.entryNumber})`,
  });

  revalidatePath("/admin/load-bill");
  revalidatePath("/admin/crm");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/farmer-credit");
  const bacha = Math.round((abTak - rakam) * 100) / 100;
  return {
    success: true,
    notice:
      zyada > 0
        ? `Rs ${rakam.toLocaleString()} aa gaye. Rs ${abTak.toLocaleString()} udhaar saaf hua, Rs ${zyada.toLocaleString()} ${name} ke credit mein jama — agli dafa udhaar ya kharche mein khud katega.`
        : bacha < 0.005
          ? `Rs ${rakam.toLocaleString()} aa gaye. ${name} ka khata ab saaf hai.`
          : `Rs ${rakam.toLocaleString()} aa gaye. ${name} par ab Rs ${bacha.toLocaleString()} baqi hain.`,
  };
}
