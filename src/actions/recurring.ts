"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postJournal, type JournalLine } from "@/lib/ledger/post";

/**
 * Har mahine wali entry (recurring journal) aur adaigi ki shartein.
 *
 * Khaka yahan likha jata hai; entry HAR MAHINE EK DABAO par banti hai.
 * Khud-ba-khud na banane ka faisla jaan boojh kar hai: bina dekhe har
 * mahine ledger mein entry chali jana wo raasta hai jahan band ho chuke
 * kiraye ki entry saal bhar chalti rehti hai aur kisi ko pata nahi
 * chalta.
 */

const ROLES = ["owner", "super_admin", "admin", "finance"];

export interface RecurringState {
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
    return { ok: false, error: "Is kaam ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }
  return { ok: true, userId: user.id };
}

export async function saveRecurring(_prev: RecurringState, formData: FormData): Promise<RecurringState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const day = Math.round(Number(formData.get("day_of_month") ?? 1));

  if (name.length < 3) return { error: "Naam likhein." };
  if (description.length < 5) return { error: "Entry ki wajah likhein — kam az kam paanch harf." };
  if (day < 1 || day > 31) return { error: "Mahine ka din 1 se 31 ke darmiyan ho." };

  const lines: { account_code: string; debit: number; credit: number; memo: string | null; line_order: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const acc = String(formData.get(`acc_${i}`) ?? "").trim();
    if (!acc) continue;
    const dr = Number(formData.get(`dr_${i}`) ?? 0) || 0;
    const cr = Number(formData.get(`cr_${i}`) ?? 0) || 0;
    if (dr === 0 && cr === 0) continue;
    if (dr > 0 && cr > 0) return { error: "Ek qatar mein debit aur credit dono nahi ho sakte." };
    lines.push({ account_code: acc, debit: dr, credit: cr, memo: String(formData.get(`memo_${i}`) ?? "").trim() || null, line_order: i + 1 });
  }

  if (lines.length < 2) return { error: "Kam az kam do qataren chahiyen — ek debit, ek credit." };

  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.round((dr - cr) * 100) !== 0) {
    return { error: `Debit (${dr.toLocaleString()}) aur credit (${cr.toLocaleString()}) barabar nahi. Farq Rs ${Math.abs(dr - cr).toLocaleString()}.` };
  }

  const service = createServiceClient();
  let recurringId = id;
  if (id) {
    const { error } = await service
      .from("recurring_journals")
      .update({ name, description, day_of_month: day })
      .eq("id", id);
    if (error) return { error: error.message };
    await service.from("recurring_journal_lines").delete().eq("recurring_id", id);
  } else {
    const { data, error } = await service
      .from("recurring_journals")
      .insert({ name, description, day_of_month: day, created_by: g.userId })
      .select("id")
      .single();
    if (error || !data) return { error: `Khaka nahi bana: ${error?.message ?? "maloom nahi"}` };
    recurringId = data.id;
  }

  const { error: lineErr } = await service
    .from("recurring_journal_lines")
    .insert(lines.map((l) => ({ ...l, recurring_id: recurringId })));
  if (lineErr) return { error: lineErr.message };

  await logAudit({
    actionType: id ? "update" : "create",
    module: "finance",
    recordId: recurringId,
    recordLabel: name,
    description: `Har mahine wali entry ka khaka ${id ? "badla" : "bana"}: ${name} (Rs ${Math.round(dr).toLocaleString()})`,
  });

  revalidatePath("/admin/finance/recurring");
  return { success: true, message: id ? "Khaka badal diya gaya." : "Khaka ban gaya. Ab har mahine ek dabao par entry banegi." };
}

/** Is mahine ki entry banayein. */
export async function postRecurring(_prev: RecurringState, formData: FormData): Promise<RecurringState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("recurring_id") ?? "").trim();
  const period = String(formData.get("period") ?? "").trim();
  if (!id) return { error: "Khaka nahi mila." };
  if (!/^\d{4}-\d{2}$/.test(period)) return { error: "Mahina chunein." };

  const service = createServiceClient();
  const { data: khaka } = await service.from("recurring_journals").select("*").eq("id", id).maybeSingle();
  if (!khaka) return { error: "Khaka nahi mila." };
  if (!khaka.is_active) return { error: "Ye khaka band hai." };

  // Ek mahine ek dafa -- database par bhi taala hai, magar yahan se saaf
  // jumla milta hai.
  const { data: pehleSe } = await service
    .from("recurring_journal_runs")
    .select("id")
    .eq("recurring_id", id)
    .eq("period", `${period}-01`)
    .maybeSingle();
  if (pehleSe) return { error: `Is khake ki ${period} wali entry pehle hi ban chuki hai.` };

  const { data: lines, error: lineErr } = await service
    .from("recurring_journal_lines")
    .select("account_code, debit, credit, memo")
    .eq("recurring_id", id)
    .order("line_order");
  if (lineErr) return { error: lineErr.message };
  if (!lines || lines.length < 2) return { error: "Is khake mein qatarein poori nahi." };

  // Mahine ka wo din jo khake mein likha hai; chhote mahine mein aakhri din.
  const saal = Number(period.slice(0, 4));
  const mah = Number(period.slice(5, 7));
  const aakhriDin = new Date(Date.UTC(saal, mah, 0)).getUTCDate();
  const din = Math.min(Number(khaka.day_of_month), aakhriDin);
  const entryDate = `${period}-${String(din).padStart(2, "0")}`;

  const aaj = new Date().toISOString().slice(0, 10);
  if (entryDate > aaj) {
    return { error: "Ye tareekh abhi aayi nahi. Aane wale din ki entry nahi banti." };
  }

  const jLines: JournalLine[] = lines.map((l) => ({
    account: l.account_code as string,
    debit: Number(l.debit) > 0 ? Number(l.debit) : undefined,
    credit: Number(l.credit) > 0 ? Number(l.credit) : undefined,
    memo: (l.memo as string | null) ?? null,
  }));

  const purani = entryDate < aaj;
  const posted = await postJournal({
    description: `${khaka.description} — ${period}`,
    sourceModule: "recurring",
    sourceId: id,
    entryDate,
    createdBy: g.userId,
    backdateReason: purani ? `Har mahine wali entry: ${khaka.name} — ${period} ka mahina` : null,
    lines: jLines,
  });
  if ("error" in posted) return { error: `Entry nahi bani: ${posted.error}` };

  const { error: runErr } = await service.from("recurring_journal_runs").insert({
    recurring_id: id,
    period: `${period}-01`,
    entry_id: posted.id,
    posted_by: g.userId,
  });
  if (runErr) {
    return { error: `Entry ${posted.entryNumber} ban gayi magar us ka nishaan darj nahi hua: ${runErr.message}. Finance ko batayein.` };
  }

  await service.from("recurring_journals").update({ last_posted_period: `${period}-01` }).eq("id", id);

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: posted.id,
    recordLabel: posted.entryNumber,
    description: `Har mahine wali entry chalayi: ${khaka.name} — ${period} (${posted.entryNumber})`,
  });

  revalidatePath("/admin/finance/recurring");
  revalidatePath("/admin/finance/statements");
  return { success: true, message: `${period} ki entry ban gayi (${posted.entryNumber}).` };
}

export async function toggleRecurring(_prev: RecurringState, formData: FormData): Promise<RecurringState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("recurring_id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "1";
  if (!id) return { error: "Khaka nahi mila." };

  const service = createServiceClient();
  const { error } = await service.from("recurring_journals").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/recurring");
  return { success: true, message: active ? "Khaka dobara chalu." : "Khaka band kar diya gaya." };
}

/** Supplier par adaigi ki shart lagana. */
export async function setSupplierTerm(_prev: RecurringState, formData: FormData): Promise<RecurringState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const termId = String(formData.get("payment_term_id") ?? "").trim();
  if (!supplierId) return { error: "Supplier nahi mila." };

  const service = createServiceClient();
  const { error } = await service
    .from("suppliers")
    .update({ payment_term_id: termId || null })
    .eq("id", supplierId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: supplierId,
    description: termId ? "Supplier par adaigi ki shart lagayi gayi" : "Supplier se adaigi ki shart hatai gayi",
  });

  revalidatePath("/admin/finance/terms");
  return { success: true, message: "Shart lag gayi. Ye NAYE purchase par lagegi; purane bill waise hi rahenge." };
}

export async function savePaymentTerm(_prev: RecurringState, formData: FormData): Promise<RecurringState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const name = String(formData.get("name") ?? "").trim();
  const days = Math.round(Number(formData.get("days") ?? -1));
  if (name.length < 2) return { error: "Shart ka naam likhein." };
  if (days < 0 || days > 365) return { error: "Din 0 se 365 ke darmiyan likhein." };

  const service = createServiceClient();
  const { error } = await service.from("payment_terms").insert({ name, days });
  if (error) return { error: error.message };

  revalidatePath("/admin/finance/terms");
  return { success: true, message: "Nayi shart ban gayi." };
}
