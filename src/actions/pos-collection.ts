"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { staffOutstandingByShop, staffShopOutstanding, type StaffShopOutstanding } from "@/lib/pos/collection-outstanding";
import { notifyRole, notifyRoles, notifyBranchManagers, notifyPositionHolders, notifyUser } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

async function nextDepositNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;
  const { data: existing } = await service.from("pos_deposit_counters").select("last_number").eq("year", year).maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await service.from("pos_deposit_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("pos_deposit_counters").insert({ year, last_number: next });
  }
  return `DEP-${year}-${String(next).padStart(5, "0")}`;
}

/** Staff ke apne shops ki Outstanding fehrist -- dashboard card ke liye. */
export async function myCollectionOutstanding(): Promise<StaffShopOutstanding[] | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  return staffOutstandingByShop(user.id);
}

/** Bank khaton ki fehrist -- deposit form ke liye. */
export async function bankAccountsForCollectionDeposit(): Promise<{ id: string; name: string }[] | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const service = createServiceClient();
  const { data } = await service.from("finance_accounts").select("id, name").eq("account_type", "bank").order("name");
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Bank Deposit Submit -- malik ka spec, section 4-5. Slip lazmi,
 * Shop/Staff khud lock, Outstanding SUBMIT karne se nahi ghatta -- sirf
 * "Pending Verification" mein jata hai.
 */
export async function submitCollectionDeposit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("pos-collection", "create");
  if ("error" in guard) return { error: guard.error };

  const shopId = String(formData.get("shop_id") ?? "");
  const bankAccountId = String(formData.get("bank_account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const depositDate = String(formData.get("deposit_date") ?? "");
  const slipUrl = (formData.get("slip_url") as string) || "";
  const note = (formData.get("staff_note") as string)?.trim() || null;

  if (!shopId) return { error: "Shop nahi mili." };
  if (!bankAccountId) return { error: "Bank khata select karein." };
  if (!amount || amount <= 0) return { error: "Raqam sahi likhein." };
  if (!depositDate) return { error: "Deposit ki tareekh select karein." };
  if (!slipUrl) return { error: "Deposit slip lazmi hai — upload karein." };

  const outstanding = await staffShopOutstanding(user.id, shopId);
  if (!outstanding) return { error: "Is shop ka koi POS record nahi mila." };
  if (amount > outstanding.outstanding + 0.01) {
    return {
      error: `Outstanding sirf Rs ${outstanding.outstanding.toLocaleString()} hai, magar Rs ${amount.toLocaleString()} jama karayi ja rahi hai.`,
    };
  }

  const service = createServiceClient();
  const depositNumber = await nextDepositNumber();
  const { data: row, error } = await service
    .from("pos_collection_deposits")
    .insert({
      deposit_number: depositNumber,
      staff_id: user.id,
      shop_id: shopId,
      branch_id: outstanding.branchId,
      bank_account_id: bankAccountId,
      amount,
      deposit_date: depositDate,
      slip_url: slipUrl,
      staff_note: note,
      outstanding_before: outstanding.outstanding,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { data: staffProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const staffName = staffProfile?.full_name ?? "Staff";
  const title = "New Bank Deposit Pending Approval";
  const message = `${outstanding.shopName} — Rs ${amount.toLocaleString()}. Submitted by: ${staffName} (${depositNumber}).`;
  const link = "/admin/finance/pos-deposits";

  await Promise.all([
    notifyRole("finance", title, message, link),
    notifyBranchManagers(outstanding.branchId, title, message, link),
    notifyRoles(["admin", "admin_assistant"], title, message, link),
    notifyPositionHolders("ceo", title, message, link),
  ]);

  await logAudit({
    actionType: "create",
    module: "pos-collection",
    recordId: row.id,
    recordLabel: depositNumber,
    description: `Bank deposit submit hua — Rs ${amount.toLocaleString()}, ${outstanding.shopName}.`,
  });

  revalidatePath("/admin/my-collection");
  revalidatePath("/admin/finance/pos-deposits");
  return {
    success: true,
    message: `${depositNumber} darj ho gaya — Rs ${amount.toLocaleString()} Finance ki tasdeeq ka intezar kar raha hai.`,
  };
}

/**
 * Finance ki tasdeeq -- Manzoor/Radd. Manzoor par hi Outstanding kam
 * hota hai (settlement); Radd par kuch nahi hilta, staff dobara sahi
 * slip ke sath jama kara sakta hai.
 *
 * Duplicate-settlement rok: UPDATE sirf `status='pending'` wali qatar
 * par chalta hai -- dobara try karein (double-click, retry) to 0 rows
 * update hoti hain aur "already processed" wapas aata hai.
 */
export async function verifyCollectionDeposit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("pos-collection.verify", "approve");
  if ("error" in guard) return { error: guard.error };
  const { caller } = guard;

  const depositId = String(formData.get("deposit_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const financeNote = String(formData.get("finance_note") ?? "").trim();
  if (!depositId) return { error: "Deposit nahi mila." };
  if (!["approve", "reject"].includes(decision)) return { error: "Faisla saaf nahi." };
  if (decision === "reject" && financeNote.length < 5) {
    return { error: "Radd karne ki wajah likhein — kam az kam 5 harf." };
  }

  const service = createServiceClient();
  const { data: deposit } = await service
    .from("pos_collection_deposits")
    .select("id, deposit_number, staff_id, shop_id, branch_id, amount, status")
    .eq("id", depositId)
    .maybeSingle();
  if (!deposit) return { error: "Deposit nahi mila." };
  if (deposit.status !== "pending") {
    return { error: "Ye deposit pehle hi process ho chuki hai." };
  }

  if (!caller.unrestricted && caller.scope !== "all") {
    if (!caller.branchId || deposit.branch_id !== caller.branchId) {
      return { error: "Ye deposit aapki branch ki nahi hai." };
    }
  }
  if (deposit.staff_id === user.id) {
    return { error: "Apni jama karayi hui deposit khud tasdeeq nahi kar sakte." };
  }

  if (decision === "reject") {
    const { data: updated, error } = await service
      .from("pos_collection_deposits")
      .update({ status: "rejected", verified_by: user.id, verified_at: new Date().toISOString(), finance_note: financeNote })
      .eq("id", depositId)
      .eq("status", "pending")
      .select("id");
    if (error) return { error: error.message };
    if (!updated || updated.length === 0) return { error: "Ye deposit pehle hi process ho chuki hai." };

    await logAudit({
      actionType: "reject",
      module: "pos-collection",
      recordId: depositId,
      recordLabel: deposit.deposit_number,
      description: `Deposit radd hui: ${financeNote}`,
    });

    await notifyUser(
      deposit.staff_id,
      "Deposit Rejected",
      `Rs ${Number(deposit.amount).toLocaleString()} verify nahi ho sake. Reason: ${financeNote}`,
      "/admin/my-collection"
    );

    revalidatePath("/admin/finance/pos-deposits");
    revalidatePath("/admin/my-collection");
    return { success: true, message: `${deposit.deposit_number} radd ho gayi.` };
  }

  // Manzoor -- yehi settlement point hai.
  const { data: updated, error } = await service
    .from("pos_collection_deposits")
    .update({ status: "approved", verified_by: user.id, verified_at: new Date().toISOString(), finance_note: financeNote || null })
    .eq("id", depositId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) return { error: "Ye deposit pehle hi process ho chuki hai." };

  // Cash-in-Hand pehle hi POS sale ke waqt "mil gaya" maan liya jata
  // hai (`finance_transactions`, `create_pos_sale`) -- yahan wohi raqam
  // BANK mein transfer ho rahi hai (Cash in Hand se), asal bill dobara
  // nahi ban raha. Isi wajah se `postJournal` (1030 wala Custody
  // system) nahi, `finance_transactions` (POS sale wala hi raasta)
  // istemal ho raha hai -- dono taraf ka hisaab ek hi tareeqe mein
  // rahe.
  const { data: depositRow } = await service
    .from("pos_collection_deposits")
    .select("bank_account_id")
    .eq("id", depositId)
    .maybeSingle();
  const { data: cashAccount } = await service.from("finance_accounts").select("id").eq("account_type", "cash").limit(1).maybeSingle();
  if (cashAccount && depositRow) {
    await service.from("finance_transactions").insert([
      {
        account_id: cashAccount.id,
        transaction_type: "transfer_out",
        category: "pos_collection_deposit",
        amount: Number(deposit.amount),
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: `POS Collection Deposit ${deposit.deposit_number} — bank mein transfer.`,
        created_by: user.id,
      },
      {
        account_id: depositRow.bank_account_id,
        transaction_type: "transfer_in",
        category: "pos_collection_deposit",
        amount: Number(deposit.amount),
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: `POS Collection Deposit ${deposit.deposit_number} — POS se aaya.`,
        created_by: user.id,
      },
    ]);
  }

  const outstandingAfter = await staffShopOutstanding(deposit.staff_id, deposit.shop_id);
  await service
    .from("pos_collection_deposits")
    .update({ outstanding_after: outstandingAfter?.outstanding ?? null })
    .eq("id", depositId);

  await logAudit({
    actionType: "approve",
    module: "pos-collection",
    recordId: depositId,
    recordLabel: deposit.deposit_number,
    description: `Deposit manzoor — Rs ${Number(deposit.amount).toLocaleString()}. Outstanding ab Rs ${(outstandingAfter?.outstanding ?? 0).toLocaleString()}.`,
  });

  await notifyUser(
    deposit.staff_id,
    "Deposit Approved",
    `Rs ${Number(deposit.amount).toLocaleString()} Finance ne verify kar diye hain. Remaining POS Outstanding: Rs ${(outstandingAfter?.outstanding ?? 0).toLocaleString()}.`,
    "/admin/my-collection"
  );

  revalidatePath("/admin/finance/pos-deposits");
  revalidatePath("/admin/my-collection");
  return { success: true, message: `${deposit.deposit_number} manzoor ho gayi.` };
}

export interface PendingDepositRow {
  id: string;
  depositNumber: string;
  staffName: string;
  shopName: string;
  branchName: string;
  amount: number;
  bankAccountName: string;
  depositDate: string;
  slipUrl: string;
  staffNote: string | null;
  outstandingBefore: number;
  submittedAt: string;
}

/** Finance ki safha -- pending deposits, poori tafseel ke sath. */
export async function pendingCollectionDeposits(): Promise<PendingDepositRow[] | { error: string }> {
  const guard = await requireAction("pos-collection.verify", "view");
  if ("error" in guard) return { error: guard.error };
  const { caller } = guard;

  const service = createServiceClient();
  let query = service
    .from("pos_collection_deposits")
    .select(
      `id, deposit_number, amount, deposit_date, slip_url, staff_note, outstanding_before, submitted_at,
       staff:profiles!pos_collection_deposits_staff_id_fkey(full_name),
       shop:shops(name),
       branch:branches(name),
       bank:finance_accounts(name)`
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (!caller.unrestricted && caller.scope !== "all" && caller.branchId) {
    query = query.eq("branch_id", caller.branchId);
  }

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id,
    depositNumber: r.deposit_number,
    staffName: (r.staff as { full_name: string | null } | null)?.full_name ?? "—",
    shopName: (r.shop as { name: string } | null)?.name ?? "—",
    branchName: (r.branch as { name: string } | null)?.name ?? "—",
    amount: Number(r.amount),
    bankAccountName: (r.bank as { name: string } | null)?.name ?? "—",
    depositDate: r.deposit_date,
    slipUrl: r.slip_url,
    staffNote: r.staff_note,
    outstandingBefore: Number(r.outstanding_before),
    submittedAt: r.submitted_at,
  }));
}

export interface MyDepositHistoryRow {
  id: string;
  depositNumber: string;
  amount: number;
  status: string;
  shopName: string;
  submittedAt: string;
  financeNote: string | null;
}

/** Staff ki apni deposit history -- dashboard par "Recent Deposits". */
export async function myDepositHistory(limit = 20): Promise<MyDepositHistoryRow[] | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };

  const service = createServiceClient();
  const { data } = await service
    .from("pos_collection_deposits")
    .select("id, deposit_number, amount, status, finance_note, submitted_at, shop:shops(name)")
    .eq("staff_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    depositNumber: r.deposit_number,
    amount: Number(r.amount),
    status: r.status,
    shopName: (r.shop as { name: string } | null)?.name ?? "—",
    submittedAt: r.submitted_at,
    financeNote: r.finance_note,
  }));
}
