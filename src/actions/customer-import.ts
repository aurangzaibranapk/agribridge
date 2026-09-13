"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { logAudit } from "@/lib/audit";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

/**
 * Purane khata-app (jaise DigiKhata) se customers ek sath laane ka
 * raasta.
 *
 * Malik (13 September): "main list bhejta hoon, isko aap draft mein
 * rakhein, final review kar ke koi changing hui to main submit karoon
 * ga."
 *
 * Isi liye seedha Customer nahi ban jata -- pehle `customer_import_drafts`
 * mein ek qatar banti hai, jo edit/delete ho sakti hai. Asal Customer aur
 * us ka shuruati baqi sirf "Submit" par bante hain, aur us ke baad wo row
 * wapas pending nahi hoti.
 *
 * Shuruati baqi CASH KO NAHI CHHUTA -- ye paisa aaj nahi diya gaya, purani
 * DigiKhata se aa raha hai. Is liye ledger mein 1100 (Customer se lena)
 * "Malik ka sarmaya" (3200, ACC.openingEquity) ke against jaata hai --
 * bilkul wohi tareeqa jo `setOpeningBalance` (finance.ts) bank/cash
 * account ke liye istemal karta hai.
 */

export interface ActionState {
  error?: string;
  success?: boolean;
  notice?: string;
}

async function ownerGuard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !UNRESTRICTED_ROLES.includes(profile.role)) {
    return { ok: false as const, error: "Ye kaam sirf admin/owner kar sakte hain." };
  }
  return { ok: true as const, supabase, userId: user.id };
}

export async function addImportDraftRows(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const raw = String(formData.get("raw_list") ?? "").trim();
  if (!raw) return { error: "List paste karein — ek customer fi line." };

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = lines
    .map((line) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      const name = parts[0] ?? "";
      const phone = parts[1]?.replace(/[^\d]/g, "") || null;
      const balanceRaw = parts[2] ? Number(parts[2].replace(/[^0-9.-]/g, "")) : 0;
      return {
        name,
        phone_number: phone,
        opening_balance: Number.isFinite(balanceRaw) ? balanceRaw : 0,
        created_by: g.userId,
      };
    })
    .filter((r) => r.name);

  if (rows.length === 0) {
    return { error: "Koi valid line nahi mili. Format: Naam, Number, Balance (ek fi line)." };
  }

  const { error } = await g.supabase.from("customer_import_drafts").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/admin/crm/import");
  return { success: true, notice: `${rows.length} customer draft mein aa gaye — ab neeche review kar ke Submit karein.` };
}

export async function updateImportDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = ((formData.get("phone_number") as string) || "").replace(/[^\d]/g, "") || null;
  const balance = Number(formData.get("opening_balance") ?? 0);

  if (!id) return { error: "Missing draft id." };
  if (!name) return { error: "Naam zaroori hai." };

  const { error } = await g.supabase
    .from("customer_import_drafts")
    .update({ name, phone_number: phone, opening_balance: Number.isFinite(balance) ? balance : 0 })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/admin/crm/import");
  return { success: true };
}

export async function deleteImportDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "");
  const { error } = await g.supabase.from("customer_import_drafts").delete().eq("id", id).eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/admin/crm/import");
  return { success: true };
}

export async function submitImportDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing draft id." };

  const service = createServiceClient();
  const { data: draft } = await service.from("customer_import_drafts").select("*").eq("id", id).maybeSingle();
  if (!draft) return { error: "Draft row nahi mili." };
  if (draft.status !== "pending") return { error: "Ye row pehle hi decide ho chuki hai." };
  if (!draft.name?.trim()) return { error: "Naam khali hai — pehle edit karein." };
  if (!draft.phone_number) return { error: "Mobile number zaroori hai — pehle edit karein." };

  let customerId: string;
  let alreadyExisted = false;
  const { data: existing } = await service
    .from("customers")
    .select("id, current_balance")
    .eq("phone_number", draft.phone_number)
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
    alreadyExisted = true;
  } else {
    const { data: created, error: cErr } = await service
      .from("customers")
      .insert({ name: draft.name, phone_number: draft.phone_number, customer_type: "retail" })
      .select("id")
      .single();
    if (cErr) return { error: `Customer nahi ban saka: ${cErr.message}` };
    customerId = created.id;
  }

  const amount = Math.round(Number(draft.opening_balance) * 100) / 100;

  if (amount !== 0) {
    // Musbat = hamein lena hai (customer par udhaar chaRha). Manfi =
    // hamein dena hai (customer ka pehle se advance/credit para hai) --
    // wohi soorat jo customer_udhaar.ts mein "purana credit" kehlati hai.
    const tafseel = `Shuruati balance (purana khata) — ${draft.name}`;
    const abs = Math.abs(amount);
    const lena = amount > 0;
    const posted = await postJournal({
      description: tafseel,
      sourceModule: "customer_import",
      sourceId: draft.id,
      branchId: null,
      createdBy: g.userId,
      lines: lena
        ? [
            { account: ACC.customerDue, debit: abs, partyType: "customer", partyId: customerId, memo: tafseel },
            { account: ACC.openingEquity, credit: abs, memo: tafseel },
          ]
        : [
            { account: ACC.openingEquity, debit: abs, memo: tafseel },
            { account: ACC.customerDue, credit: abs, partyType: "customer", partyId: customerId, memo: tafseel },
          ],
    });
    if ("error" in posted) {
      // Naya customer ban gaya magar ledger mein nahi ja saka -- adhoora
      // nahi chhorna, customer wapas hata dete hain jab hum ne khud banaya tha.
      if (!alreadyExisted) await service.from("customers").delete().eq("id", customerId);
      return { error: `Ledger mein nahi ja saka, is liye import nahi hua: ${posted.error}` };
    }

    const { data: cust } = await service.from("customers").select("current_balance").eq("id", customerId).maybeSingle();
    const abTak = cust?.current_balance == null ? 0 : Number(cust.current_balance);
    await service
      .from("customers")
      .update({ current_balance: Math.round((abTak + amount) * 100) / 100 })
      .eq("id", customerId);
  }

  await service
    .from("customer_import_drafts")
    .update({ status: "imported", imported_customer_id: customerId, decided_by: g.userId, decided_at: new Date().toISOString() })
    .eq("id", id);

  const balanceLine =
    amount > 0
      ? ` — shuruati baqi (lena hai) Rs ${amount.toLocaleString()}`
      : amount < 0
        ? ` — shuruati advance/credit (dena hai) Rs ${Math.abs(amount).toLocaleString()}`
        : "";

  await logAudit({
    actionType: "create",
    module: "crm",
    recordId: customerId,
    recordLabel: draft.name,
    description: `Purane khata se import: ${draft.name}${balanceLine}${alreadyExisted ? " (pehle se maujood customer se jorha gaya)" : ""}`,
  });

  revalidatePath("/admin/crm/import");
  revalidatePath("/admin/crm");
  return { success: true, notice: `${draft.name} import ho gaye${balanceLine}.` };
}

export async function rejectImportDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await ownerGuard();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("id") ?? "");
  const { error } = await g.supabase
    .from("customer_import_drafts")
    .update({ status: "rejected", decided_by: g.userId, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: error.message };

  revalidatePath("/admin/crm/import");
  return { success: true };
}
