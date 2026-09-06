"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { requireAction } from "@/lib/access/guard";
import { nextExpenseNumber } from "@/lib/expense-number";
import { postJournal } from "@/lib/ledger/post";
import { glForFinanceAccount, expenseAccountFor, ACC } from "@/lib/ledger/rules";
import { cashBookLikhein } from "@/lib/ledger/cash-book";
import { qismDhoondein, qismKaNaamSaaf, APNI_QISM } from "@/lib/kharche";

/** Migration 347 ke baad ki qatar -- jab tak types dobara na banein. */
interface KharchaQatar {
  id: string;
  expense_number: string;
  kind: string | null;
  category: string | null;
  amount: number;
  description: string | null;
  status: string;
  party_type: string | null;
  party_id: string | null;
  party_name: string | null;
  paid_from_account_id: string | null;
  expense_date: string | null;
  branch_id: string | null;
  requested_by: string | null;
}

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Rozana ka kharcha aur adaigi — darj se manzoori tak.
 *
 * Malik (6 September): *"daily koi bhi bill hai wo add kar sakein, jis
 * ki manzoori manager dega. Kisi ko paisa diya hai to us ke khaate mein
 * add kar sakein; agar aaya to us ke khaate mein jama kar sakein."*
 *
 * -------------------------------------------------------------------
 * DARJ KARNA AUR KITAB MEIN JANA DO ALAG LAMHE HAIN
 *
 * Darkhwast par kuch nahi hota -- na ledger, na Cash Book, na kisi ka
 * khata. Sab kuch MANZOORI par hota hai, aur ek hi jagah se.
 *
 * Ye tarteeb jaan boojh kar hai: jo manzoor nahi hua wo abhi kharcha hai
 * hi nahi. Darkhwast par kitab hilane se har ghalat parchi bhi kitab
 * mein aa jati, aur us ko nikalne ke liye ulti qatar banani parti.
 */

const MANZOORI_WALE = ["manager", "admin_assistant", "finance"];

/**
 * Is bande par mazdoori ka kya haal hai -- ledger se.
 *
 * `actions/mazdoori.ts` mein bhi yehi hisaab hai. Dono jagah ek hi sawal
 * hai aur ek hi jawab dena chahiye; naql se bachne ka behtar tareeqa
 * database ka `fn_mazdoori_haal` hai, magar wo `fn_is_any_staff()` ke
 * peeche hai aur service client us gate se nahi guzarta. Is liye yahan
 * wohi hisaab ledger se seedha lagta hai.
 */
async function mazdooriKaHaal(partyType: string, partyId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("journal_lines")
    .select("account_code, debit, credit")
    .eq("party_type", partyType)
    .eq("party_id", partyId)
    .in("account_code", [ACC.workerAdvance, ACC.workerPayable]);

  let advance = 0;
  let dena = 0;
  for (const l of (data ?? []) as { account_code: string; debit: number | null; credit: number | null }[]) {
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (l.account_code === ACC.workerAdvance) advance += d - c;
    else dena += c - d;
  }
  return { advanceBaqi: Math.max(advance, 0), denaBaqi: Math.max(dena, 0) };
}

async function main() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id, shop_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return { error: "Ye account fa'aal nahi hai." };
  return {
    userId: user.id,
    role: String(profile.role),
    branchId: (profile.branch_id as string | null) ?? null,
    shopId: (profile.shop_id as string | null) ?? null,
    naam: (profile.full_name as string | null) ?? "",
  };
}

/** Dukan par baitha banda bill darj karta hai. */
export async function kharchaDarj(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const guard = await requireAction("kharche", "create");
  if ("error" in guard) return { error: guard.error };

  const kind = String(formData.get("kind") ?? "");
  const qism = qismDhoondein(kind);
  if (!qism) return { error: "Len-den ki qism chunein." };

  const amount = Number(formData.get("amount") ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Raqam sahi likhein." };

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Tafseel likhein — baad mein yehi batati hai ke paisa kis cheez ka tha." };

  /**
   * Qism -- fehrist se, ya apni likhi hui.
   *
   * Malik: *"agar koi us se alag expense ke andar add karna chahe to
   * naam kar sake."* "Deegar" chunne par apna naam likha jata hai aur
   * WOHI qism ban kar mehfooz hoti hai -- warna aadha mahina "Deegar"
   * mein para reh jata aur koi report qism ke hisaab se jorr nahi
   * sakti.
   */
  let category = String(formData.get("category") ?? "").trim() || APNI_QISM;
  if (category === APNI_QISM) {
    const apni = qismKaNaamSaaf(String(formData.get("category_apni") ?? ""));
    if (!apni) return { error: "Apni qism ka naam likhein (jaise: spray wala, mazdoori, ghar ka kharcha)." };
    category = apni;
  }

  const expenseDate = String(formData.get("expense_date") ?? "").trim();
  if (!expenseDate) return { error: "Tareekh likhein." };

  const accountId = String(formData.get("paid_from_account_id") ?? "").trim();
  if (!accountId) {
    // Khali chhorne dena yahan sab se mehngi khamoshi hoti: kitab
    // barabar rehti aur Finance ke safhe par khate ka adad hilta hi
    // nahi -- aur wohi adad malik parhte hain.
    return { error: "Ye batayein ke paisa kis khate se gaya (ya kis mein aaya)." };
  }

  /**
   * Kaun le gaya / kis ko diya.
   *
   * Malik: *"kaun le gaya — Mohsin le gaya... Baba le gaya... Rana le
   * gaya... aaj spray wala le gaya, kitna — 3000."*
   *
   * Ye har qatar par poochha jata hai, chahe wo asal kharcha ho. Sawal
   * hamesha yehi hota hai ke "ye 4000 kis ne liye the", aur us ka jawab
   * usi waqt likha jaye to mahine baad kisi ko dhoondna nahi parta.
   *
   * Registered banda ho to us ki ID bhi mehfooz hoti hai (malik: *"agar
   * koi farmer aa jata hai to wo already register hoga, us ki id aani
   * chahiye"*), chahe us qatar se us ka BALANCE na hila ho.
   */
  const partyType = String(formData.get("party_type") ?? "").trim() || null;
  const partyId = String(formData.get("party_id") ?? "").trim() || null;
  const partyName = String(formData.get("party_name") ?? "").trim() || null;

  if (!partyId && !partyName) {
    return { error: "Ye likhein ke paisa kaun le gaya (ya kis se aaya) — baad mein sab se pehla sawal yehi hota hai." };
  }

  // Jis qism ka apna khata banta hai, us mein banda usi fehrist ka hona
  // chahiye. Warna kisan ka advance staff ke khate mein ja kar baith
  // jata -- aur wo ghalti kabhi khud nazar nahi aati.
  if (qism.bandaZaroori) {
    if (!partyId) {
      return {
        error: `"${qism.label}" mein paisa wapas aana ya jana hai, is liye banda fehrist se chunna parta hai — sirf naam likhne se us ka khata nahi banta.`,
      };
    }
    // Kuch qismein kisi bhi fehrist ka banda qubool karti hain (mazdoori
    // wale khate) -- malik ka poora nuqta yehi tha ke wohi banda kisan
    // bhi ho sakta hai, customer bhi aur mazdoor bhi. Jin qismon ka apna
    // khata ek hi fehrist ka hai, un mein wo bandhish lagti hai.
    if (qism.bandaKahanSe && partyType !== qism.bandaKahanSe) {
      return { error: `"${qism.label}" ke liye banda ${qism.bandaKahanSe} ki fehrist se chunein.` };
    }
  }

  const service = createServiceClient();

  let documentUrl: string | null = null;
  const doc = formData.get("document");
  if (doc instanceof File && doc.size > 0) {
    const path = `${Date.now()}-${doc.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: uploadError } = await service.storage.from("expense-documents").upload(path, doc);
    if (!uploadError) {
      const { data } = service.storage.from("expense-documents").getPublicUrl(path);
      documentUrl = data.publicUrl;
    }
  }

  const expenseNumber = await nextExpenseNumber();
  const { data: row, error } = await (service.from("company_expense_requests") as any)
    .insert({
      expense_number: expenseNumber,
      kind,
      category,
      amount,
      description,
      document_url: documentUrl,
      expense_date: expenseDate,
      // Naam aur ID har qatar par -- khata banna ya na banna alag baat
      // hai, wo qism tay karti hai (dekhein `kharchaManzoor`).
      party_type: partyType,
      party_id: partyId,
      party_name: partyName,
      paid_from_account_id: accountId,
      // `supplier_id` purane safhe ke liye bhara ja raha hai -- wahan ki
      // report abhi usi khane se supplier ka naam nikalti hai.
      supplier_id: partyType === "supplier" ? partyId : null,
      branch_id: who.branchId,
      shop_id: who.shopId,
      requested_by: who.userId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "kharche",
    recordId: row?.id,
    recordLabel: expenseNumber,
    description: `${qism.label} — Rs ${amount.toLocaleString()} (manzoori ka intezar)`,
  });

  revalidatePath("/admin/kharche");
  return { success: true, message: `${expenseNumber} darj ho gaya — ab manager ki manzoori ka intezar hai.` };
}

/**
 * Manzoori — aur teen jagah ek sath hilti hain.
 *
 * Tarteeb ahem hai: pehle LEDGER, phir Cash Book. Ledger na bane to
 * halat "approved" nahi hoti aur Cash Book mein bhi kuch nahi jata --
 * warna paisa Cash Book mein nikal jata aur kitab mein us ka koi nishan
 * na hota.
 */
export async function kharchaManzoor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const guard = await requireAction("kharche", "approve");
  if ("error" in guard) {
    // Purane raaste wale ke liye ohde ki fehrist bhi dekhi jati hai --
    // warna nayi feature key aane se pehle wale manager ruk jate.
    if (!MANZOORI_WALE.includes(who.role) && !["owner", "super_admin", "admin"].includes(who.role)) {
      return { error: "Manzoori sirf Manager, Admin Assistant, Finance ya Admin de sakta hai." };
    }
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Kharche ki qatar nahi mili." };

  const service = createServiceClient();
  // Naye khane (kind, party_*, paid_from_account_id, expense_date)
  // migration 347 ke hain; generated types abhi us se pehle ke hain. Ye
  // cast types dobara banne par hat jayega.
  const { data: kharcha } = (await service
    .from("company_expense_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()) as { data: KharchaQatar | null };

  if (!kharcha) return { error: "Ye kharcha nahi mila." };
  if (kharcha.status === "approved") {
    // Do dafa manzoori se do dafa qatarein banti hain -- aur wo ghalti
    // mahine baad, khate ka milan karte waqt nikalti hai.
    return { error: "Ye pehle hi manzoor ho chuka hai. Dobara manzoori se dohri qatarein ban jayengi." };
  }
  if (kharcha.status === "rejected") return { error: "Ye radd ho chuka hai. Nayi qatar banayein." };

  const qism = qismDhoondein(String(kharcha.kind ?? ""));
  if (!qism) return { error: "Is qatar ki qism pehchani nahi ja saki." };

  const amount = Number(kharcha.amount ?? 0);
  if (amount <= 0) return { error: "Raqam sifar ya manfi hai — ye qatar post nahi ho sakti." };

  const accountId = kharcha.paid_from_account_id as string | null;
  if (!accountId) return { error: "Is qatar par khata darj nahi hai. Pehle wo theek karwayein." };

  const cashGl = await glForFinanceAccount(accountId);
  const saamnaGl = qism.saamneWalaKhata ?? expenseAccountFor(kharcha.category);
  const tafseel = `${kharcha.expense_number} — ${qism.label}: ${kharcha.description}`;

  // Paisa gaya: saamne wala khata DEBIT, cash CREDIT.
  // Paisa aaya: cash DEBIT, saamne wala khata CREDIT.
  /**
   * Registered bande ka naam ledger ki qatar par bhi lagta hai.
   *
   * Malik (6 September): *"agar koi farmer aa jata hai to wo already
   * register hoga, us ki id aani chahiye — yahan gaya, us ke ledger mein
   * bhi khaate mein darj ho raha hoga."*
   *
   * Is liye party CASH WALI qatar par nahi, DOOSRI qatar par lagti hai
   * -- aur hamesha lagti hai, chahe wo asal kharcha ho.
   *
   * Farq ye rehta hai ke wo qatar KIS khate par baithti hai, aur wohi
   * tay karta hai ke us bande ka balance hilta hai ya nahi:
   *
   *   * Advance / adaigi / wasooli -> 1130, 1140, 1100, 2000 -- ye us ke
   *     BALANCE wale khate hain. Wahan qatar us ka baqi badalti hai.
   *   * Asal kharcha -> 6xxx. Wahan qatar us ke naam se nazar aati hai
   *     magar us par koi udhaar nahi banta.
   *
   * Ye farq jaan boojh kar hai: "spray wala 3000 le gaya" ek kharcha hai
   * -- us par 3000 ka udhaar nahi. Magar wo qatar us ke naam ke sath
   * dhoondi ja sakni chahiye.
   */
  if (qism.bandaKahanSe && kharcha.party_type !== qism.bandaKahanSe) {
    return {
      error: `Is qatar ki qism "${qism.label}" hai magar banda ${String(kharcha.party_type ?? "darj nahi")} ki fehrist ka hai. Ghalat khate mein baithne se behtar hai ke pehle ye theek ho.`,
    };
  }

  const partyId = (kharcha.party_id as string | null) ?? null;
  const partyType = partyId ? ((kharcha.party_type as string | null) ?? null) : null;

  /**
   * Mazdoori ki adaigi -- pehle jo dena tha wo, phir baqi advance.
   *
   * Malik ka misaal ulta bhi chalta hai: banda pehle Rs 3,000 le jata
   * hai aur kaam BAAD mein karta hai. Aisi soorat mein us waqt us par
   * koi "dena" hai hi nahi -- wo paisa advance hai, kharcha nahi.
   *
   * Is liye adaigi do hisson mein baith sakti hai:
   *
   *   * Jitna "mazdoori dena" (2015) baqi tha -- utna wahan se katta hai.
   *   * Us se ZYADA diya -- wo baqi raqam nayi advance (1145) ban kar us
   *     par charh jati hai.
   *
   * Dono soorton mein KHARCHA nahi banta: kharcha us din bana tha (ya
   * banega) jis din kaam hua.
   */
  let lines: {
    account: string;
    debit?: number;
    credit?: number;
    partyType?: string | null;
    partyId?: string | null;
    memo: string;
  }[];

  if (qism.value === "mazdoori_ki_adaigi" && partyId && partyType) {
    const { denaBaqi } = await mazdooriKaHaal(partyType, partyId);
    const utra = Math.min(denaBaqi, amount);
    const nayaAdvance = Math.round((amount - utra) * 100) / 100;

    lines = [];
    if (utra > 0) {
      lines.push({ account: ACC.workerPayable, debit: utra, partyType, partyId, memo: `${tafseel} — dena utra` });
    }
    if (nayaAdvance > 0) {
      lines.push({
        account: ACC.workerAdvance,
        debit: nayaAdvance,
        partyType,
        partyId,
        memo: `${tafseel} — dene se zyada diya, ye advance hai`,
      });
    }
    lines.push({ account: cashGl, credit: amount, memo: tafseel });
  } else if (qism.rukh === "gaya") {
    lines = [
      { account: saamnaGl, debit: amount, partyType, partyId, memo: tafseel },
      { account: cashGl, credit: amount, memo: tafseel },
    ];
  } else {
    lines = [
      { account: cashGl, debit: amount, memo: tafseel },
      { account: saamnaGl, credit: amount, partyType, partyId, memo: tafseel },
    ];
  }

  const posted = await postJournal({
    description: tafseel,
    sourceModule: "kharche",
    sourceId: id,
    branchId: (kharcha.branch_id as string | null) ?? who.branchId,
    entryDate: (kharcha.expense_date as string | null) ?? undefined,
    createdBy: who.userId,
    claims: [{ table: "company_expense_requests", rowId: id }],
    lines,
  });

  if ("error" in posted) {
    return { error: `Kitab mein qatar nahi bani, is liye manzoori bhi nahi di gayi: ${posted.error}` };
  }

  const { error: halatError } = await service
    .from("company_expense_requests")
    .update({ status: "approved", approved_by: who.userId, approved_at: new Date().toISOString() })
    .eq("id", id);

  if (halatError) {
    return {
      error: `Kitab mein qatar to ban gayi magar halat "manzoor" nahi ho saki: ${halatError.message}. Kisi ko batayein — dobara manzoori se dohri qatar ban jayegi.`,
    };
  }

  // Cash Book -- `finance_accounts.current_balance` SIRF yahan se banta
  // hai (127). Ye qatar na bane to Finance ka safha purana adad dikhata
  // rehta hai, chahe kitab barabar ho.
  const { error: cashError } = await cashBookLikhein([
    {
      accountId,
      amount,
      rukh: qism.rukh === "gaya" ? "gaya" : "aaya",
      category: qism.value,
      notes: tafseel,
      tareekh: (kharcha.expense_date as string | null) ?? undefined,
      createdBy: who.userId,
    },
  ]);

  await logAudit({
    actionType: "approve",
    module: "kharche",
    recordId: id,
    recordLabel: kharcha.expense_number,
    description: `${qism.label} — Rs ${amount.toLocaleString()} manzoor. ${qism.asar}`,
  });

  revalidatePath("/admin/kharche");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/money-trail");
  revalidatePath("/admin/reports/sales");

  if (cashError) {
    return {
      success: true,
      message: `Manzoor ho gaya aur kitab mein darj hai — magar Cash Book ki qatar nahi bani: ${cashError}. Finance ke safhe par khate ka adad abhi purana rahega.`,
    };
  }

  return { success: true, message: `${kharcha.expense_number} manzoor. ${qism.asar}` };
}

/** Radd karna — wajah ke saath. */
export async function kharchaRadd(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const who = await main();
  if ("error" in who) return { error: who.error };

  const guard = await requireAction("kharche", "reject");
  if ("error" in guard) {
    if (!MANZOORI_WALE.includes(who.role) && !["owner", "super_admin", "admin"].includes(who.role)) {
      return { error: "Radd karna sirf Manager, Admin Assistant, Finance ya Admin ka kaam hai." };
    }
  }

  const id = String(formData.get("id") ?? "");
  const wajah = String(formData.get("rejection_reason") ?? "").trim();
  if (!id) return { error: "Kharche ki qatar nahi mili." };
  if (!wajah) return { error: "Radd karne ki wajah likhein — us ke baghair darj karne wale ko pata nahi chalta ke kya theek karna hai." };

  const service = createServiceClient();
  const { data: kharcha } = await service
    .from("company_expense_requests")
    .select("expense_number, status")
    .eq("id", id)
    .maybeSingle();
  if (!kharcha) return { error: "Ye kharcha nahi mila." };
  if (kharcha.status === "approved") {
    return { error: "Ye manzoor ho kar kitab mein ja chuka hai. Radd nahi hota — ulti qatar banayein." };
  }

  const { error } = await service
    .from("company_expense_requests")
    .update({ status: "rejected", rejection_reason: wajah })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "reject",
    module: "kharche",
    recordId: id,
    recordLabel: kharcha.expense_number,
    description: `Radd: ${wajah}`,
  });

  revalidatePath("/admin/kharche");
  return { success: true, message: "Radd kar diya." };
}
