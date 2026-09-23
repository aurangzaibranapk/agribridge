"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { postStaffLedger, failed, ACC } from "@/lib/ledger/rules";
import { REASON_MIN } from "@/lib/ledger/stock-count";
import { requireAction } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Milan (Review) mein "kami" (shortage) ko Sale Staff ke khate mein
 * bhejna -- malik (15 September): "farq ko sale staff ke khate mein ya
 * loss mein -- staff ko yahin farq bhej ke confirmation li jaye."
 *
 * Faisle: us shop ke active Sale Staff zimmedar hain (1 ho to poora,
 * zyada hon to barabar baant); har product ka apna alag button/qatar
 * (lump-sum nahi); confirm karne par asal katauti (staff_credit_ledger
 * debit, tankhwah se katega).
 *
 * postCount() jaisa hi -- reasons validate, stock sync, count posted --
 * sirf itna farq: shortage ka JOURNAL abhi nahi banta, staff ki
 * tasdeeq ka intezar rehta hai (confirmLiabilityShare/decline...).
 * Izafa (overage) hamesha ki tarah foran post ho jata hai -- wo staff
 * ka masla nahi.
 */
export async function sendShortageToStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("stock-count", "approve");
  if ("error" in guard) return { error: guard.error };

  const { data: count } = await service
    .from("stock_counts")
    .select("id, status, warehouse_id, warehouses(name, branch_id)")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting" && count.status !== "verified") {
    return { error: "Ye ginti pehle hi mukammal ho chuki hai." };
  }
  const branchId = (count.warehouses as { branch_id: string } | null)?.branch_id ?? null;
  const warehouseName = (count.warehouses as { name: string } | null)?.name ?? "godam";
  if (!branchId) return { error: "Is godam ki branch maloom nahi — staff zimmedar tay nahi ho saka." };

  const { data: lines } = await service
    .from("stock_count_lines")
    .select("id, product_id, inventory_id, expected_qty, counted_qty, difference_qty, unit_cost, reason, products(name)")
    .eq("count_id", countId);

  const rows = lines ?? [];
  const unfilled = rows.filter((r) => r.counted_qty === null);
  if (unfilled.length > 0) {
    return { error: `${unfilled.length} cheezen abhi gini nahi gayin. Milaan se pehle poori ginti lazmi hai.` };
  }

  const missingReason: string[] = [];
  const updates: { id: string; reason: string; value: number; name: string }[] = [];
  for (const line of rows) {
    const diff = Number(line.difference_qty ?? 0);
    const reason = String(formData.get(`reason_${line.id}`) ?? "").trim();
    const name = (line.products as { name: string } | null)?.name ?? "—";
    if (diff === 0) continue;
    if (reason.length < REASON_MIN) {
      missingReason.push(name);
      continue;
    }
    updates.push({ id: line.id, reason, value: round2(diff * Number(line.unit_cost)), name });
  }
  if (missingReason.length > 0) {
    return {
      error: `In cheezon ka farq bina wajah ke nahi chhora ja sakta: ${missingReason.join(", ")}.`,
    };
  }

  let shortValue = 0;
  let overValue = 0;
  for (const u of updates) {
    if (u.value < 0) shortValue += Math.abs(u.value);
    else overValue += u.value;
  }
  shortValue = round2(shortValue);
  overValue = round2(overValue);
  const netValue = round2(overValue - shortValue);

  if (shortValue <= 0) {
    return { error: "Is ginti mein koi 'kami' (shortage) nahi hai — staff ke khate mein bhejne ko kuch nahi." };
  }

  const { data: staffRows } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("branch_id", branchId)
    .eq("role", "sales_staff")
    .eq("is_active", true);
  const staff = staffRows ?? [];
  if (staff.length === 0) {
    return { error: "Is shop ka koi Sale Staff nahi mila — zimmedar tay nahi ho saka. Pehle HR mein staff ki branch set karein." };
  }

  let overEntryId: string | null = null;
  if (overValue > 0) {
    const posted = await postJournal({
      description: `Maal ki ginti (izafa) — ${warehouseName}`,
      sourceModule: "stock_count",
      sourceId: countId,
      branchId,
      createdBy: user.id,
      lines: [
        { account: ACC.stockGoods, debit: overValue, memo: "Stock barha" },
        { account: ACC.stockLoss, credit: overValue, memo: "Ginti mein maal zyada nikla" },
      ],
    });
    if ("error" in posted) return { error: `Izafa ledger mein darj nahi ho saka: ${posted.error}` };
    overEntryId = posted.id;
  }

  for (const u of updates) {
    await service.from("stock_count_lines").update({ reason: u.reason, difference_value: u.value }).eq("id", u.id);
  }

  const INCREASE_TYPES = new Set(["purchase_in", "transfer_in", "adjustment_increase", "return_in"]);
  for (const line of rows) {
    const diff = Number(line.difference_qty ?? 0);
    if (diff === 0 || !line.inventory_id) continue;
    const { data: already } = await service
      .from("stock_movements")
      .select("movement_type, quantity")
      .eq("inventory_id", line.inventory_id)
      .eq("reference_type", "stock_count")
      .eq("reference_id", countId);
    const alreadyApplied = (already ?? []).reduce(
      (sum, m) => sum + (INCREASE_TYPES.has(m.movement_type) ? 1 : -1) * Number(m.quantity),
      0
    );
    const remaining = round2(diff - alreadyApplied);
    if (remaining === 0) continue;
    await service.from("stock_movements").insert({
      inventory_id: line.inventory_id,
      movement_type: remaining < 0 ? "adjustment_decrease" : "adjustment_increase",
      quantity: Math.abs(remaining),
      reference_type: "stock_count",
      reference_id: countId,
      notes: updates.find((u) => u.id === line.id)?.reason ?? "Ginti se milaan",
      created_by: user.id,
    });
  }

  const { error: postErr } = await service
    .from("stock_counts")
    .update({
      status: "posted",
      posted_by: user.id,
      posted_at: new Date().toISOString(),
      total_difference_value: netValue,
      journal_entry_id: overEntryId,
    })
    .eq("id", countId);
  if (postErr) return { error: postErr.message };

  const { data: request, error: reqErr } = await service
    .from("stock_count_liability_requests")
    .insert({ count_id: countId, branch_id: branchId, total_short_value: shortValue, requested_by: user.id })
    .select("id")
    .single();
  if (reqErr || !request) {
    return { error: `Ginti mukammal ho gayi magar staff ko bheja nahi ja saka: ${reqErr?.message}` };
  }

  // Har farq wali cheez ka apna alag button — lump-sum nahi (malik, 15
  // September). Ek cheez ka farq staff ki tadaad mein barabar baant.
  const shareInserts: {
    request_id: string;
    count_line_id: string;
    product_name: string;
    reason: string;
    profile_id: string;
    share_amount: number;
  }[] = [];
  for (const u of updates) {
    if (u.value >= 0) continue;
    const lineShort = Math.abs(u.value);
    const per = round2(lineShort / staff.length);
    let assigned = 0;
    staff.forEach((s, i) => {
      const amt = i === staff.length - 1 ? round2(lineShort - assigned) : per;
      assigned = round2(assigned + amt);
      shareInserts.push({
        request_id: request.id,
        count_line_id: u.id,
        product_name: u.name,
        reason: u.reason,
        profile_id: s.id,
        share_amount: amt,
      });
    });
  }
  const { error: sharesErr } = await service.from("stock_count_liability_shares").insert(shareInserts);
  if (sharesErr) return { error: `Hisse banate waqt masla: ${sharesErr.message}` };

  revalidatePath("/admin/stock-count");
  revalidatePath("/admin/money-trail");
  revalidatePath("/admin/inventory");

  const names = staff.map((s) => s.full_name).join(", ");
  return {
    success: true,
    message: `Ginti mukammal. Rs ${shortValue.toLocaleString()} ka farq ${names} ke khate ke liye bheja gaya — har product ki tasdeeq ka intezar hai.`,
  };
}

async function loadShareForResolve(service: ReturnType<typeof createServiceClient>, shareId: string) {
  const { data: share } = await service
    .from("stock_count_liability_shares")
    .select("id, profile_id, share_amount, status, product_name, request_id")
    .eq("id", shareId)
    .maybeSingle();
  if (!share) return { share: null, request: null };
  const { data: request } = await service
    .from("stock_count_liability_requests")
    .select("id, branch_id, count_id")
    .eq("id", share.request_id)
    .maybeSingle();
  return { share, request };
}

async function canResolveShare(supabase: ReturnType<typeof createClient>, userId: string, shareProfileId: string): Promise<boolean> {
  if (shareProfileId === userId) return true;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));
}

/**
 * Staff (ya Admin) is product ke farq ko qabool karta hai -- asal
 * katauti yahin hoti hai (staff_credit_ledger debit).
 */
export async function confirmLiabilityShare(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const shareId = String(formData.get("share_id") ?? "");
  if (!shareId) return { error: "Qatar nahi mili." };

  const { share, request } = await loadShareForResolve(service, shareId);
  if (!share) return { error: "Qatar nahi mili." };
  if (share.status !== "pending") return { error: "Ye pehle hi nipat chuki hai." };
  if (!(await canResolveShare(supabase, user.id, share.profile_id))) {
    return { error: "Ye sirf zimmedar staff ya Admin/Owner confirm kar sakta hai." };
  }

  const { data: ledgerRow, error: insErr } = await service
    .from("staff_credit_ledger")
    .insert({
      profile_id: share.profile_id,
      ledger_type: "debit",
      source_type: "stock_count_shortage",
      amount: share.share_amount,
      notes: `Stock ginti ka farq — ${share.product_name}`,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insErr || !ledgerRow) return { error: insErr?.message ?? "Khate mein darj nahi ho saka." };

  const posted = await postStaffLedger({
    profileId: share.profile_id,
    amount: share.share_amount,
    ledgerType: "debit",
    sourceType: "stock_count_shortage",
    description: `Stock ginti ka farq — ${share.product_name} (tasdeeq shuda)`,
    ctx: { createdBy: user.id, branchId: request?.branch_id ?? null, claims: [{ table: "staff_credit_ledger", rowId: ledgerRow.id }] },
  });
  if (failed(posted)) return { error: `Khate mein darj hua magar ledger mein nahi gaya: ${posted.error}` };

  await service
    .from("stock_count_liability_shares")
    .update({ status: "confirmed", resolved_at: new Date().toISOString() })
    .eq("id", shareId);

  revalidatePath("/admin/stock-count");
  revalidatePath("/admin/staff-khata");
  revalidatePath("/admin/money-trail");
  return { success: true, message: `Qabool — Rs ${share.share_amount.toLocaleString()} khate se kat gaya (${share.product_name}).` };
}

/**
 * Staff (ya Admin) is product ke farq ko mana karta hai -- raqam
 * company ke "Stock ka nuqsan" khate mein chali jati hai, staff ke
 * khate ko haath nahi lagta.
 */
export async function declineLiabilityShare(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const shareId = String(formData.get("share_id") ?? "");
  if (!shareId) return { error: "Qatar nahi mili." };

  const { share, request } = await loadShareForResolve(service, shareId);
  if (!share) return { error: "Qatar nahi mili." };
  if (share.status !== "pending") return { error: "Ye pehle hi nipat chuki hai." };
  if (!(await canResolveShare(supabase, user.id, share.profile_id))) {
    return { error: "Ye sirf zimmedar staff ya Admin/Owner decline kar sakta hai." };
  }

  const posted = await postJournal({
    description: `Ginti ka farq (mana kiya) — ${share.product_name}`,
    sourceModule: "stock_count",
    sourceId: request?.count_id ?? shareId,
    branchId: request?.branch_id ?? null,
    createdBy: user.id,
    lines: [
      { account: ACC.stockLoss, debit: share.share_amount, memo: "Ginti ka farq — staff ne mana kiya" },
      { account: ACC.stockGoods, credit: share.share_amount, memo: "Stock ghata" },
    ],
  });
  if ("error" in posted) return { error: posted.error };

  await service
    .from("stock_count_liability_shares")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", shareId);

  revalidatePath("/admin/stock-count");
  revalidatePath("/admin/money-trail");
  return { success: true, message: `Mana kar diya — Rs ${share.share_amount.toLocaleString()} company ke "Stock ka nuqsan" khate mein chala gaya (${share.product_name}).` };
}
