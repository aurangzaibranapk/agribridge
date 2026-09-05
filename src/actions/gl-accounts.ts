"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postJournal } from "@/lib/ledger/post";
import { trialBalance } from "@/lib/ledger/statements";

/**
 * Khaton ki fehrist (Chart of Accounts).
 *
 * Naya khata banana asaan rakha gaya hai; purane khate ko BADALNA nahi.
 * Wajah ye hai ke khata sirf ek naam nahi -- wo har us entry ka matlab
 * hai jo us mein ja chuki. "1200 Stock" ko baad mein kharcha bana dene
 * se pichhle saal ka har goshara chup chaap badal jata hai, aur kisi ko
 * pata nahi chalta.
 *
 * Is liye qism aur rukh badalne ki rok DATABASE mein hai (302), yahan
 * nahi. Yahan sirf saaf jumla banaya jata hai.
 */

const ROLES = ["owner", "super_admin", "admin", "finance"];

export interface GlAccountState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function gate(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return { ok: false, error: "Khate banane ya badalne ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }
  return { ok: true, userId: user.id };
}

const TYPES = ["asset", "liability", "equity", "income", "expense"];

export async function saveGlAccount(_prev: GlAccountState, formData: FormData): Promise<GlAccountState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const original = String(formData.get("original_code") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const accountType = String(formData.get("account_type") ?? "").trim();
  const normalSide = String(formData.get("normal_side") ?? "").trim();
  const isContra = String(formData.get("is_contra") ?? "") === "on";
  const sortOrder = Math.round(Number(formData.get("sort_order") ?? 0)) || 0;

  if (!/^[0-9]{4}$/.test(code)) {
    return { error: "Khate ka code chaar hindson ka hona chahiye — 1xxx asaasa, 2xxx zimma, 3xxx sarmaya, 4xxx aamdani, 5xxx/6xxx kharcha." };
  }
  if (name.length < 3) return { error: "Khate ka naam likhein." };
  if (!TYPES.includes(accountType)) return { error: "Qism chunein." };
  if (normalSide !== "debit" && normalSide !== "credit") return { error: "Rukh chunein." };
  if (original && original !== code) {
    // Code par journal_lines ki foreign key hai. Code badalne ka matlab
    // hai purani qatarein kisi aur khate ki ho jana.
    return { error: "Khate ka code badalta nahi. Naya code chahiye to naya khata banayein." };
  }

  const service = createServiceClient();
  const row = {
    code,
    name,
    account_type: accountType,
    normal_side: normalSide,
    is_contra: isContra,
    sort_order: sortOrder,
  };

  if (original) {
    const { data: pehle } = await service
      .from("gl_accounts")
      .select("name, account_type, normal_side, is_contra, sort_order")
      .eq("code", code)
      .maybeSingle();

    const { error } = await service.from("gl_accounts").update(row).eq("code", code);
    if (error) return { error: error.message };

    await logAudit({
      actionType: "update",
      module: "finance",
      recordId: code,
      recordLabel: `${code} — ${name}`,
      description: `Khata badla: ${code} ${name}`,
      changes: pehle
        ? {
            name: { pehle: pehle.name, ab: name },
            account_type: { pehle: pehle.account_type, ab: accountType },
            normal_side: { pehle: pehle.normal_side, ab: normalSide },
          }
        : undefined,
    });
  } else {
    const { data: maujood } = await service.from("gl_accounts").select("code, name").eq("code", code).maybeSingle();
    if (maujood) return { error: `Ye code pehle se maujood hai: ${maujood.code} — ${maujood.name}` };

    const { error } = await service.from("gl_accounts").insert(row);
    if (error) return { error: error.message };

    await logAudit({
      actionType: "create",
      module: "finance",
      recordId: code,
      recordLabel: `${code} — ${name}`,
      description: `Naya khata: ${code} ${name} (${accountType})`,
    });
  }

  revalidatePath("/admin/finance/accounts");
  revalidatePath("/admin/finance/journal-entry");
  return { success: true, message: original ? "Khata badal diya gaya." : "Naya khata ban gaya." };
}

export async function toggleGlAccount(_prev: GlAccountState, formData: FormData): Promise<GlAccountState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const code = String(formData.get("code") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "1";
  if (!code) return { error: "Khata nahi mila." };

  const service = createServiceClient();
  const { error } = await service.from("gl_accounts").update({ is_active: active }).eq("code", code);
  // Database ka jumla wesa hi aage jata hai -- wo bata deta hai ke kitni
  // raqam pari hai. Us ki jagah apna aam jumla likh dena us maloomat ko
  // zaya kar dena hai.
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: code,
    recordLabel: code,
    description: active ? `Khata dobara khola: ${code}` : `Khata band kiya: ${code}`,
  });

  revalidatePath("/admin/finance/accounts");
  return { success: true, message: active ? "Khata dobara khul gaya." : "Khata band ho gaya." };
}

/**
 * Khate ka baqi doosre khate mein le jana ("account merge").
 *
 * Asli merge -- yani purani qatarein utha kar doosre khate mein likh
 * dena -- ye nizam JAAN BOOJH KAR nahi karta. Us ka matlab hota hai ke
 * pichhle saal ka har goshara chup chaap badal jaye, aur jo kaghaz
 * pehle nikala ja chuka wo aaj ke nizam se mail khana band kar de.
 *
 * Is ki jagah wohi hota hai jo hisaab mein hamesha hota aaya hai: ek
 * NAYI entry se baqi ek khate se doosre mein le jaya jata hai. Purani
 * qatarein apni jagah rehti hain, nayi entry apni jagah -- aur dono
 * nazar aati hain.
 */
export async function transferAccountBalance(_prev: GlAccountState, formData: FormData): Promise<GlAccountState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const from = String(formData.get("from_code") ?? "").trim();
  const to = String(formData.get("to_code") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const closeIt = String(formData.get("close_source") ?? "") === "on";

  if (!from || !to) return { error: "Dono khate chunein." };
  if (from === to) return { error: "Ek hi khate se usi khate mein raqam nahi jati." };
  if (reason.length < 10) return { error: "Wajah likhein — kam az kam das harf. Ye wajah hamesha darj rahegi." };

  const aaj = new Date().toISOString().slice(0, 10);
  const tb = await trialBalance("1900-01-01", aaj);
  if (tb.error) return { error: `Baqi nahi gina ja saka: ${tb.error}` };

  const row = tb.rows.find((r) => r.code === from);
  if (!row || Math.abs(row.balance) < 0.005) {
    return { error: "Is khate mein kuch para hi nahi — le jane ko koi raqam nahi." };
  }

  // Baqi apne rukh par hai. Debit rukh wale khate ka musbat baqi ka
  // matlab hai wahan debit para hai -- usay khatam karne ke liye credit
  // karna parta hai.
  const rakam = Math.abs(row.balance);
  const sourceKoCredit = row.normal_side === "debit" ? row.balance > 0 : row.balance < 0;

  const posted = await postJournal({
    description: `Khate ka baqi ${from} se ${to} mein: ${reason}`,
    sourceModule: "account_transfer",
    entryDate: aaj,
    createdBy: g.userId,
    lines: sourceKoCredit
      ? [
          { account: to, debit: rakam, memo: reason },
          { account: from, credit: rakam, memo: reason },
        ]
      : [
          { account: from, debit: rakam, memo: reason },
          { account: to, credit: rakam, memo: reason },
        ],
  });
  if ("error" in posted) return { error: `Entry nahi bani: ${posted.error}` };

  const service = createServiceClient();
  if (closeIt) {
    // Ab baqi sifar hai, is liye database ki rok is ko rokegi nahi.
    await service.from("gl_accounts").update({ is_active: false }).eq("code", from);
  }

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: from,
    recordLabel: `${from} -> ${to}`,
    description: `Khate ka baqi le jaya gaya: ${from} se ${to}, Rs ${Math.round(rakam).toLocaleString()} — wajah: ${reason} (${posted.entryNumber})${closeIt ? " — purana khata band" : ""}`,
  });

  revalidatePath("/admin/finance/accounts");
  revalidatePath("/admin/finance/statements");
  return {
    success: true,
    message: `Rs ${Math.round(rakam).toLocaleString()} ${from} se ${to} mein chali gayi (${posted.entryNumber}).${closeIt ? " Purana khata band kar diya gaya." : ""}`,
  };
}
