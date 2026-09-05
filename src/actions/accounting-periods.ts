"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postJournal, type JournalLine } from "@/lib/ledger/post";
import { trialBalance } from "@/lib/ledger/statements";
import { ACC } from "@/lib/ledger/rules";

/**
 * Mahina band karna, dobara kholna, aur saal band karna.
 *
 * Band karne ka matlab ye NAHI ke kuch mit gaya. Matlab sirf itna hai
 * ke us arse mein naya indraj nahi ja sakta -- kyunki us arse ka
 * goshara dekha ja chuka aur us par faisle ho chuke. Us ke baad wahan
 * ek entry aur chali jaye to har wo kaghaz jhoota ho jata hai jo pehle
 * nikala ja chuka, aur ye kisi ko nazar nahi aata.
 *
 * Rok DATABASE mein hai (305), yahan nahi. Yahan sirf tarteeb, jaanch
 * aur saaf jumla hai.
 */

const ROLES = ["owner", "super_admin", "admin", "finance"];

export interface PeriodState {
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
    return { ok: false, error: "Mahina band ya khol sakne ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }
  return { ok: true, userId: user.id };
}

function mahinaKaAakhir(period: string): string {
  const saal = Number(period.slice(0, 4));
  const mah = Number(period.slice(5, 7));
  return new Date(Date.UTC(saal, mah, 0)).toISOString().slice(0, 10);
}

export async function closePeriod(_prev: PeriodState, formData: FormData): Promise<PeriodState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const period = String(formData.get("period") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Mahina chunein." };
  const pehlaDin = `${period}-01`;
  const aakhiriDin = mahinaKaAakhir(period);

  const aaj = new Date().toISOString().slice(0, 10);
  if (aakhiriDin > aaj) {
    return { error: "Ye mahina abhi guzra nahi. Chalta hua mahina band nahi hota — us mein abhi kaam ho raha hai." };
  }

  // Barabri ki jaanch band karne se PEHLE. Ghair-barabar ledger ke sath
  // mahina band kar dena us farq ko hamesha ke liye wahin band kar dena
  // hai -- aur us ke baad us par sawal poochhna bhi mushkil ho jata hai.
  const tb = await trialBalance(pehlaDin, aakhiriDin);
  if (tb.error) return { error: `Goshara nahi mila, is liye mahina band nahi kiya gaya: ${tb.error}` };
  if (Math.abs(tb.farq) > 0.009) {
    return {
      error: `Is mahine ka Trial Balance barabar nahi (farq Rs ${Math.abs(tb.farq).toLocaleString()}). Pehle wo farq dekha jaye — barabar hue baghair mahina band nahi hota.`,
    };
  }

  const service = createServiceClient();
  const { data: maujood } = await service
    .from("accounting_periods")
    .select("id, status")
    .eq("period", pehlaDin)
    .maybeSingle();
  if (maujood?.status === "closed") return { error: "Ye mahina pehle hi band hai." };

  const row = {
    period: pehlaDin,
    status: "closed",
    closed_by: g.userId,
    closed_at: new Date().toISOString(),
    note: String(formData.get("note") ?? "").trim() || null,
  };

  const { error } = maujood
    ? await service.from("accounting_periods").update(row).eq("id", maujood.id)
    : await service.from("accounting_periods").insert(row);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: pehlaDin,
    recordLabel: period,
    description: `Hisaab ka mahina band kiya: ${period}`,
  });

  revalidatePath("/admin/finance/periods");
  return { success: true, message: `${period} band ho gaya. Ab us mein koi nayi entry nahi jayegi.` };
}

export async function reopenPeriod(_prev: PeriodState, formData: FormData): Promise<PeriodState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const period = String(formData.get("period") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Mahina chunein." };
  if (reason.length < 10) {
    return { error: "Dobara kholne ki wajah likhein — kam az kam das harf. Ye wajah hamesha darj rahegi." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("accounting_periods")
    .update({
      status: "open",
      closed_at: null,
      reopened_by: g.userId,
      reopened_at: new Date().toISOString(),
      reopen_reason: reason,
    })
    .eq("period", `${period}-01`);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: `${period}-01`,
    recordLabel: period,
    description: `Band mahina DOBARA khola gaya: ${period} — wajah: ${reason}`,
  });

  revalidatePath("/admin/finance/periods");
  return { success: true, message: `${period} dobara khul gaya. Wajah darj ho chuki.` };
}

/**
 * Saal band karna.
 *
 * Nafa nuqsan ke khate (aamdani aur kharche) sirf EK saal ke hote hain.
 * Saal khatam hone par un ka baqi sarmaye mein chala jata hai aur wo
 * khate sifar se dobara shuru hote hain -- warna agle saal ka "nafa"
 * pichhle saal ka nafa bhi apne andar rakhta hai.
 *
 * Ye ek hi entry se hota hai: har aamdani ka khata debit, har kharche
 * ka khata credit, aur farq "Pichhla nafa" (3200) mein.
 */
export async function closeYear(_prev: PeriodState, formData: FormData): Promise<PeriodState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const saal = Number(formData.get("year") ?? 0);
  if (!saal || saal < 2000 || saal > 2100) return { error: "Saal chunein." };

  const shuru = `${saal}-01-01`;
  const khatam = `${saal}-12-31`;
  const aaj = new Date().toISOString().slice(0, 10);
  if (khatam > aaj) return { error: "Ye saal abhi guzra nahi. Chalta hua saal band nahi hota." };

  const service = createServiceClient();
  const { data: pehleSe } = await service
    .from("accounting_periods")
    .select("period, closing_entry_id")
    .eq("period", `${saal}-12-01`)
    .maybeSingle();
  if (pehleSe?.closing_entry_id) return { error: "Ye saal pehle hi band ho chuka hai." };

  const tb = await trialBalance(shuru, khatam);
  if (tb.error) return { error: `Goshara nahi mila: ${tb.error}` };

  const lines: JournalLine[] = [];
  let nafa = 0;
  for (const r of tb.rows) {
    if (r.account_type !== "income" && r.account_type !== "expense") continue;
    if (Math.abs(r.balance) < 0.005) continue;
    if (r.account_type === "income") {
      // Aamdani ka baqi credit ki taraf hota hai -- band karne ke liye
      // usay debit kiya jata hai.
      lines.push({ account: r.code, debit: r.balance, memo: `Saal ${saal} band` });
      nafa += r.balance;
    } else {
      lines.push({ account: r.code, credit: r.balance, memo: `Saal ${saal} band` });
      nafa -= r.balance;
    }
  }

  if (lines.length === 0) {
    return { error: "Is saal mein nafa nuqsan ka koi khata nahi chala — band karne ko kuch nahi." };
  }

  nafa = Math.round(nafa * 100) / 100;
  lines.push(
    nafa >= 0
      ? { account: ACC.openingEquity, credit: nafa, memo: `Saal ${saal} ka nafa` }
      : { account: ACC.openingEquity, debit: -nafa, memo: `Saal ${saal} ka nuqsan` }
  );

  const posted = await postJournal({
    description: `Saal ${saal} band — nafa nuqsan ke khate sarmaye mein`,
    sourceModule: "year_close",
    sourceId: `${saal}`,
    entryDate: khatam,
    createdBy: g.userId,
    backdateReason: `Saal ${saal} band karne ki entry — hamesha us saal ke aakhri din ki hoti hai`,
    lines,
  });
  if ("error" in posted) return { error: `Band karne ki entry nahi bani: ${posted.error}` };

  // Entry ban jane ke BAAD mahine band hote hain. Ulta karne par apni hi
  // rok apni entry ko rok deti.
  const mahine = Array.from({ length: 12 }, (_, i) => `${saal}-${String(i + 1).padStart(2, "0")}-01`);
  for (const p of mahine) {
    const { data: m } = await service.from("accounting_periods").select("id").eq("period", p).maybeSingle();
    const row = {
      period: p,
      status: "closed",
      closed_by: g.userId,
      closed_at: new Date().toISOString(),
      ...(p === `${saal}-12-01` ? { closing_entry_id: posted.id } : {}),
    };
    if (m) await service.from("accounting_periods").update(row).eq("id", m.id);
    else await service.from("accounting_periods").insert(row);
  }

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: String(saal),
    recordLabel: String(saal),
    description: `Saal ${saal} band — ${nafa >= 0 ? "nafa" : "nuqsan"} Rs ${Math.abs(Math.round(nafa)).toLocaleString()} sarmaye mein (${posted.entryNumber})`,
  });

  revalidatePath("/admin/finance/periods");
  revalidatePath("/admin/finance/statements");
  return {
    success: true,
    message: `Saal ${saal} band ho gaya. ${nafa >= 0 ? "Nafa" : "Nuqsan"} Rs ${Math.abs(Math.round(nafa)).toLocaleString()} sarmaye mein chala gaya (${posted.entryNumber}).`,
  };
}
