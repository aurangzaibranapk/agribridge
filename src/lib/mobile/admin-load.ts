/**
 * Admin phone reads and the same row updates the ERP website uses.
 * Counts that do not come back stay null — never a made-up zero.
 */

import {
  approvalHeading,
  categoryLabel,
  leaveSteps,
  litreLabel,
  milkSteps,
  otherSteps,
  planLeaveDecision,
  planMilkDecision,
  planPurchaseDecision,
  purchaseSteps,
  rupeeLabel,
  type DeskActor,
  type DeskPlan,
  type DeskStep,
  type InboxItem,
} from "./admin-desk";
import { acceptedSupabaseUrl, dataFlavor, type FetchLike } from "./live-login";
import {
  liveCount,
  liveGet,
  liveGetScoped,
  liveInsert,
  livePatchWhere,
  liveRpc,
  loadTestPending,
  type LiveAuth,
  type MilkRow,
} from "./live-read";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function numOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function idList(ids: string[]): string {
  return ids.filter((id) => ID.test(id)).join(",");
}

async function profileNames(auth: LiveAuth, ids: string[], fetchImpl: FetchLike): Promise<Map<string, string>> {
  const listed = idList(ids);
  const names = new Map<string, string>();
  if (!listed) return names;
  const rows = await liveGet<{ id?: string; full_name?: string | null }>(auth, `profiles?select=id,full_name&id=in.(${listed})&limit=80`, fetchImpl);
  if (!rows.ok) return names;
  for (const row of rows.rows) if (row.id && row.full_name) names.set(row.id, row.full_name);
  return names;
}

type RpcItem = {
  category?: string | null;
  group_key?: string | null;
  item_id?: string | null;
  ref?: string | null;
  title?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  entered_by?: string | null;
  entered_by_name?: string | null;
  actor_name?: string | null;
  pending_with?: string | null;
  is_own?: boolean | null;
};

function fromRpc(row: RpcItem): InboxItem | null {
  const itemId = String(row.item_id || "");
  if (!ID.test(itemId)) return null;
  return {
    category: String(row.category || "other"),
    groupKey: String(row.group_key || ""),
    itemId,
    ref: row.ref || null,
    title: row.title || null,
    amount: numOrNull(row.amount),
    createdAt: String(row.created_at || ""),
    enteredBy: row.entered_by || null,
    enteredByName: row.entered_by_name || null,
    actorName: row.actor_name || null,
    pendingWith: row.pending_with || null,
    isOwn: row.is_own === true,
  };
}

async function enrichInbox(auth: LiveAuth, rows: InboxItem[], fetchImpl: FetchLike): Promise<void> {
  const milkIds = idList(rows.filter((row) => row.category === "milk_verify").map((row) => row.itemId));
  const purchaseIds = idList(rows.filter((row) => row.category === "purchases").map((row) => row.itemId));
  const [milk, purchases] = await Promise.all([
    milkIds ? liveGetScoped<{ id?: string; farmer_id?: string | null; total_amount?: number | string | null }>(auth, `milk_entries?select=id,farmer_id,total_amount&id=in.(${milkIds})&limit=80`, fetchImpl) : Promise.resolve(null),
    purchaseIds ? liveGetScoped<{ id?: string; supplier_id?: string | null; total_amount?: number | string | null }>(auth, `purchases?select=id,supplier_id,total_amount&id=in.(${purchaseIds})&limit=80`, fetchImpl) : Promise.resolve(null),
  ]);
  const farmerIds = milk?.ok ? idList(milk.rows.map((row) => String(row.farmer_id || ""))) : "";
  const supplierIds = purchases?.ok ? idList(purchases.rows.map((row) => String(row.supplier_id || ""))) : "";
  const [farmers, suppliers, people] = await Promise.all([
    farmerIds ? liveGetScoped<{ id?: string; full_name?: string | null }>(auth, `farmers?select=id,full_name&id=in.(${farmerIds})&limit=80`, fetchImpl) : Promise.resolve(null),
    supplierIds ? liveGet<{ id?: string; name?: string | null }>(auth, `suppliers?select=id,name&id=in.(${supplierIds})&limit=80`, fetchImpl) : Promise.resolve(null),
    profileNames(auth, rows.map((row) => row.enteredBy || ""), fetchImpl),
  ]);
  const farmerName = new Map<string, string>();
  if (farmers?.ok) for (const row of farmers.rows) if (row.id && row.full_name) farmerName.set(row.id, row.full_name);
  const supplierName = new Map<string, string>();
  if (suppliers?.ok) for (const row of suppliers.rows) if (row.id && row.name) supplierName.set(row.id, row.name);
  const milkFarmer = new Map<string, string>();
  const milkAmount = new Map<string, number | null>();
  if (milk?.ok) {
    for (const row of milk.rows) {
      if (!row.id) continue;
      const name = row.farmer_id ? farmerName.get(row.farmer_id) : "";
      if (name) milkFarmer.set(row.id, name);
      milkAmount.set(row.id, numOrNull(row.total_amount));
    }
  }
  const purchaseSupplier = new Map<string, string>();
  const purchaseAmount = new Map<string, number | null>();
  if (purchases?.ok) {
    for (const row of purchases.rows) {
      if (!row.id) continue;
      const name = row.supplier_id ? supplierName.get(row.supplier_id) : "";
      if (name) purchaseSupplier.set(row.id, name);
      purchaseAmount.set(row.id, numOrNull(row.total_amount));
    }
  }
  for (const row of rows) {
    if (!row.enteredByName && row.enteredBy) row.enteredByName = people.get(row.enteredBy) || null;
    if (row.category === "milk_verify") {
      row.title = milkFarmer.get(row.itemId) || row.title;
      if (row.amount == null) row.amount = milkAmount.get(row.itemId) ?? null;
    }
    if (row.category === "purchases") {
      row.title = purchaseSupplier.get(row.itemId) || row.title;
      if (row.amount == null) row.amount = purchaseAmount.get(row.itemId) ?? null;
    }
  }
}

async function testInbox(auth: LiveAuth, fetchImpl: FetchLike): Promise<{ rows: InboxItem[]; note: string | null; failed: boolean }> {
  const notes: string[] = [];
  const rows: InboxItem[] = [];
  const milk = await liveGetScoped<MilkRow & { created_at?: string | null }>(
    auth,
    "milk_entries?select=id,farmer_id,quantity_liters,total_amount,status,created_by,collected_at,entry_date&status=in.(pending_fat,priced)&order=entry_date.desc&limit=40",
    fetchImpl,
  );
  if (!milk.ok) notes.push(milk.message);
  else {
    for (const row of milk.rows) {
      if (!row.id || !ID.test(row.id)) continue;
      rows.push({
        category: "milk_verify",
        groupKey: "milk",
        itemId: row.id,
        ref: null,
        title: null,
        amount: numOrNull(row.total_amount),
        createdAt: String(row.collected_at || row.entry_date || ""),
        enteredBy: row.created_by || null,
        enteredByName: null,
        actorName: null,
        pendingWith: "milk_verifier",
        isOwn: Boolean(auth.userId && row.created_by === auth.userId),
      });
    }
  }
  const purchases = await liveGetScoped<{ id?: string; purchase_number?: string | null; total_amount?: number | string | null; created_at?: string | null; created_by?: string | null }>(
    auth,
    "purchases?select=id,purchase_number,total_amount,created_at,created_by&review_status=in.(submitted,verified)&order=created_at.desc&limit=40",
    fetchImpl,
  );
  if (!purchases.ok) notes.push(purchases.message);
  else {
    for (const row of purchases.rows) {
      if (!row.id || !ID.test(row.id)) continue;
      rows.push({
        category: "purchases",
        groupKey: "purchase",
        itemId: row.id,
        ref: row.purchase_number || null,
        title: null,
        amount: numOrNull(row.total_amount),
        createdAt: String(row.created_at || ""),
        enteredBy: row.created_by || null,
        enteredByName: null,
        actorName: null,
        pendingWith: "purchase_checker",
        isOwn: Boolean(auth.userId && row.created_by === auth.userId),
      });
    }
  }
  const leave = await liveGetScoped<{ id?: string; leave_type?: string | null; created_at?: string | null; profile_id?: string | null }>(
    auth,
    "leave_requests?select=id,leave_type,created_at,profile_id&status=eq.pending&order=created_at.desc&limit=40",
    fetchImpl,
  );
  if (!leave.ok) notes.push(leave.message);
  else {
    for (const row of leave.rows) {
      if (!row.id || !ID.test(row.id)) continue;
      rows.push({
        category: "leave",
        groupKey: "hr",
        itemId: row.id,
        ref: null,
        title: row.leave_type || null,
        amount: null,
        createdAt: String(row.created_at || ""),
        enteredBy: row.profile_id || null,
        enteredByName: null,
        actorName: null,
        pendingWith: "manager",
        isOwn: Boolean(auth.userId && row.profile_id === auth.userId),
      });
    }
  }
  return { rows, note: notes[0] ?? null, failed: notes.length > 0 && rows.length === 0 };
}

export async function loadAdminInbox(auth: LiveAuth, fetchImpl: FetchLike): Promise<{ ok: true; rows: InboxItem[]; note: string | null } | { ok: false; message: string }> {
  if (auth.testAccount) {
    const test = await testInbox(auth, fetchImpl);
    if (test.failed) return { ok: false, message: test.note || "Approvals nahi khulin." };
    await enrichInbox(auth, test.rows, fetchImpl);
    return { ok: true, rows: test.rows, note: test.note };
  }
  const res = await liveRpc<RpcItem[] | null>(auth, "fn_admin_pending_items", { p_limit: 80 }, fetchImpl);
  if (!res.ok) return { ok: false, message: res.message };
  const rows = (Array.isArray(res.data) ? res.data : []).map(fromRpc).filter((row): row is InboxItem => row != null);
  await enrichInbox(auth, rows, fetchImpl);
  return { ok: true, rows, note: null };
}

export type DeskCounts = {
  farmers: number | null;
  farmersNote: string | null;
  staff: number | null;
  staffNote: string | null;
  support: number | null;
  supportNote: string | null;
  cash: number | null;
  cashNote: string | null;
  pending: number | null;
  pendingNote: string | null;
};

async function oneCount(auth: LiveAuth, path: string, fetchImpl: FetchLike): Promise<{ count: number | null; note: string | null }> {
  const res = await liveCount(auth, path, fetchImpl);
  if (!res.ok) return { count: null, note: res.message };
  return { count: res.count, note: null };
}

export async function loadDeskCounts(auth: LiveAuth, today: string, fetchImpl: FetchLike): Promise<DeskCounts> {
  const [farmers, staff, support, cash, pending] = await Promise.all([
    oneCount(auth, "farmers?select=id", fetchImpl),
    oneCount(auth, `attendance_records?select=id&attendance_date=eq.${today}&status=in.(present,half_day)`, fetchImpl),
    oneCount(auth, "support_tickets?select=id&status=in.(new,assigned,investigating,testing,resolved_pending_verify,reopened)", fetchImpl),
    oneCount(auth, "txn_whatsapp_alerts?select=id&status=eq.pending", fetchImpl),
    loadPendingTotal(auth, fetchImpl),
  ]);
  return {
    farmers: farmers.count,
    farmersNote: farmers.note,
    staff: staff.count,
    staffNote: staff.note,
    support: support.count,
    supportNote: support.note,
    cash: cash.count,
    cashNote: cash.note,
    pending: pending.count,
    pendingNote: pending.note,
  };
}

async function loadPendingTotal(auth: LiveAuth, fetchImpl: FetchLike): Promise<{ count: number | null; note: string | null }> {
  if (auth.testAccount) {
    const pending = await loadTestPending(auth, fetchImpl);
    if (!pending.ok) return { count: null, note: pending.message };
    return { count: pending.data.reduce((sum, row) => sum + Number(row.pending || 0), 0), note: null };
  }
  const res = await liveRpc<Array<{ pending?: number | null; readable?: boolean | null; is_info?: boolean | null }> | null>(auth, "fn_admin_pending_counts", {}, fetchImpl);
  if (!res.ok) return { count: null, note: res.message };
  const rows = Array.isArray(res.data) ? res.data : [];
  const hidden = rows.some((row) => row.readable === false && row.is_info !== true);
  const count = rows.filter((row) => row.readable !== false && row.is_info !== true).reduce((sum, row) => sum + Number(row.pending || 0), 0);
  return { count, note: hidden ? "Kuch categories is login ko nahi dikhin." : null };
}

export type AdminIdentity = {
  ok: true;
  fullName: string;
  role: string;
  extraRoles: string[];
  phone: string | null;
  email: string | null;
  place: string | null;
  org: string | null;
  designation: string | null;
  photoUrl: string | null;
  gaps: string[];
};

export async function loadAdminIdentity(auth: LiveAuth, fetchImpl: FetchLike): Promise<AdminIdentity | { ok: false; message: string }> {
  const userId = auth.userId?.trim() || "";
  if (!ID.test(userId)) return { ok: false, message: "Login ka profile id nahi mila." };
  const id = encodeURIComponent(userId);
  const [profile, staff, email] = await Promise.all([
    liveGet<{ full_name?: string | null; role?: string | null; extra_roles?: string[] | null; phone_number?: string | null; branch_id?: string | null; shop_id?: string | null; organization_id?: string | null }>(
      auth,
      `profiles?select=full_name,role,extra_roles,phone_number,branch_id,shop_id,organization_id&id=eq.${id}&limit=1`,
      fetchImpl,
    ),
    liveGet<{ phone?: string | null; designation?: string | null; photo_url?: string | null; branch_id?: string | null }>(
      auth,
      `staff_details?select=phone,designation,photo_url,branch_id&profile_id=eq.${id}&limit=1`,
      fetchImpl,
    ),
    loadAuthEmail(auth, fetchImpl),
  ]);
  if (!profile.ok) return { ok: false, message: profile.message };
  const row = profile.rows[0];
  if (!row?.full_name) return { ok: false, message: "Is login ki profile nahi mili." };
  const gaps: string[] = [];
  if (!staff.ok) gaps.push(staff.message);
  if (!email.ok) gaps.push(email.message);
  const branchId = row.branch_id || (staff.ok ? staff.rows[0]?.branch_id : null) || null;
  const shopId = row.shop_id || null;
  const orgId = row.organization_id || null;
  const [branch, shop, org] = await Promise.all([
    branchId && ID.test(branchId) ? liveGet<{ name?: string | null }>(auth, `branches?select=name&id=eq.${encodeURIComponent(branchId)}&limit=1`, fetchImpl) : Promise.resolve(null),
    shopId && ID.test(shopId) ? liveGet<{ name?: string | null }>(auth, `shops?select=name&id=eq.${encodeURIComponent(shopId)}&limit=1`, fetchImpl) : Promise.resolve(null),
    orgId && ID.test(orgId) ? liveGet<{ name?: string | null }>(auth, `organizations?select=name&id=eq.${encodeURIComponent(orgId)}&limit=1`, fetchImpl) : Promise.resolve(null),
  ]);
  if (branch && !branch.ok) gaps.push(branch.message);
  if (shop && !shop.ok) gaps.push(shop.message);
  if (org && !org.ok) gaps.push(org.message);
  const branchName = branch?.ok ? branch.rows[0]?.name || null : null;
  const shopName = shop?.ok ? shop.rows[0]?.name || null : null;
  const photo = staff.ok ? staff.rows[0]?.photo_url || null : null;
  return {
    ok: true,
    fullName: row.full_name,
    role: String(row.role || ""),
    extraRoles: Array.isArray(row.extra_roles) ? row.extra_roles.map(String) : [],
    phone: row.phone_number || (staff.ok ? staff.rows[0]?.phone || null : null),
    email: email.ok ? email.email : null,
    place: [branchName, shopName].filter(Boolean).join(" / ") || null,
    org: org?.ok ? org.rows[0]?.name || null : null,
    designation: staff.ok ? staff.rows[0]?.designation || null : null,
    photoUrl: photo && /^https:\/\//.test(photo) ? photo : null,
    gaps,
  };
}

async function loadAuthEmail(auth: LiveAuth, fetchImpl: FetchLike): Promise<{ ok: true; email: string | null } | { ok: false; message: string }> {
  const base = acceptedSupabaseUrl(auth.url, dataFlavor(auth.flavor));
  if (!base) return { ok: false, message: "Email host set nahi." };
  try {
    const res = await fetchImpl(`${base}/auth/v1/user`, {
      headers: { apikey: auth.anonKey, authorization: `Bearer ${auth.token}` },
    });
    const text = await res.text();
    if (res.status >= 400) return { ok: false, message: "Email is login se nahi khula." };
    const body = JSON.parse(text) as { email?: string | null };
    return { ok: true, email: body.email || null };
  } catch {
    return { ok: false, message: "Email network se nahi aaya." };
  }
}

export type ApprovalRecord = {
  heading: string;
  partyLabel: string;
  party: string;
  quantity: string;
  amount: string;
  steps: DeskStep[];
  action: "milk" | "leave" | "purchase" | "none";
  milk: { id: string; status: string | null; createdBy: string | null; mcaProfileId: string | null } | null;
  leave: { id: string; profileId: string | null; status: string | null } | null;
  purchase: {
    id: string;
    reviewStatus: string | null;
    status: string | null;
    createdBy: string | null;
    verifiedBy: string | null;
    creatorRole: string | null;
    held: { amount?: number | null; posted?: boolean | null } | null;
  } | null;
  note: string | null;
};

export async function loadApprovalRecord(auth: LiveAuth, item: InboxItem, fetchImpl: FetchLike): Promise<ApprovalRecord> {
  const base = {
    heading: approvalHeading(item.category),
    partyLabel: "Party name",
    party: item.title || item.enteredByName || item.ref || categoryLabel(item.category),
    quantity: "—",
    amount: item.amount == null ? "—" : rupeeLabel(item.amount),
    steps: otherSteps(item),
    action: "none" as const,
    milk: null,
    leave: null,
    purchase: null,
    note: null as string | null,
  };
  if (item.category === "milk_verify") return loadMilkRecord(auth, item, fetchImpl, base);
  if (item.category === "leave") return loadLeaveRecord(auth, item, fetchImpl, base);
  if (item.category === "purchases") return loadPurchaseRecord(auth, item, fetchImpl, base);
  return { ...base, note: "Is qisam ka faisla ERP website par hota hai, kyunke wahan account ya stock ka extra qadam hai. Yahan wahi record hai." };
}

async function loadMilkRecord(auth: LiveAuth, item: InboxItem, fetchImpl: FetchLike, base: ApprovalRecord): Promise<ApprovalRecord> {
  const row = await liveGetScoped<MilkRow & { fat_by_profile_id?: string | null; verified_by_profile_id?: string | null }>(
    auth,
    `milk_entries?select=id,status,quantity_liters,total_amount,farmer_id,created_by,mca_profile_id,collected_at,entry_date,fat_at,fat_by_profile_id,verified_at,verified_by_profile_id&id=eq.${item.itemId}&limit=1`,
    fetchImpl,
  );
  if (!row.ok || !row.rows[0]?.id) return { ...base, note: row.ok ? "Ye doodh record nahi mila." : row.message };
  const milk = row.rows[0];
  const farmer = milk.farmer_id && ID.test(milk.farmer_id)
    ? await liveGetScoped<{ full_name?: string | null }>(auth, `farmers?select=full_name&id=eq.${milk.farmer_id}&limit=1`, fetchImpl)
    : null;
  const names = await profileNames(auth, [milk.created_by || "", milk.fat_by_profile_id || "", milk.verified_by_profile_id || ""], fetchImpl);
  const party = (farmer?.ok ? farmer.rows[0]?.full_name : null) || item.title || "Party record nahi";
  return {
    ...base,
    partyLabel: "Party name",
    party,
    quantity: litreLabel(numOrNull(milk.quantity_liters)),
    amount: rupeeLabel(numOrNull(milk.total_amount)),
    steps: milkSteps({
      status: milk.status || null,
      collectedAt: milk.collected_at || milk.entry_date || null,
      fatAt: milk.fat_at || null,
      verifiedAt: milk.verified_at || null,
      requestedBy: (milk.created_by && names.get(milk.created_by)) || item.enteredByName,
      checkedBy: (milk.fat_by_profile_id && names.get(milk.fat_by_profile_id)) || null,
      decidedBy: (milk.verified_by_profile_id && names.get(milk.verified_by_profile_id)) || null,
    }),
    action: "milk",
    milk: { id: milk.id || item.itemId, status: milk.status || null, createdBy: milk.created_by || null, mcaProfileId: milk.mca_profile_id || null },
    note: farmer && !farmer.ok ? farmer.message : null,
  };
}

async function loadLeaveRecord(auth: LiveAuth, item: InboxItem, fetchImpl: FetchLike, base: ApprovalRecord): Promise<ApprovalRecord> {
  const row = await liveGet<{ id?: string; profile_id?: string | null; leave_type?: string | null; from_date?: string | null; to_date?: string | null; days?: number | null; status?: string | null; created_at?: string | null; manager_id?: string | null; decided_at?: string | null }>(
    auth,
    `leave_requests?select=id,profile_id,leave_type,from_date,to_date,days,status,created_at,manager_id,decided_at&id=eq.${item.itemId}&limit=1`,
    fetchImpl,
  );
  if (!row.ok || !row.rows[0]?.id) return { ...base, partyLabel: "Staff", note: row.ok ? "Ye chhutti nahi mili." : row.message };
  const leave = row.rows[0];
  const names = await profileNames(auth, [leave.profile_id || "", leave.manager_id || ""], fetchImpl);
  const who = (leave.profile_id && names.get(leave.profile_id)) || item.enteredByName || "Staff";
  const days = leave.days != null ? `${leave.days} din` : [leave.from_date, leave.to_date].filter(Boolean).join(" – ") || "—";
  return {
    ...base,
    partyLabel: "Staff",
    party: who,
    quantity: days,
    amount: leave.leave_type ? leave.leave_type.replace(/_/g, " ") : "—",
    steps: leaveSteps({
      status: leave.status || null,
      requestedBy: who,
      managerName: (leave.manager_id && names.get(leave.manager_id)) || null,
      createdAt: leave.created_at || null,
      decidedAt: leave.decided_at || null,
    }),
    action: "leave",
    leave: { id: leave.id || item.itemId, profileId: leave.profile_id || null, status: leave.status || null },
  };
}

async function loadPurchaseRecord(auth: LiveAuth, item: InboxItem, fetchImpl: FetchLike, base: ApprovalRecord): Promise<ApprovalRecord> {
  const row = await liveGetScoped<{
    id?: string;
    purchase_number?: string | null;
    total_amount?: number | string | null;
    supplier_id?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    verified_by?: string | null;
    verified_at?: string | null;
    reviewed_at?: string | null;
    review_status?: string | null;
    status?: string | null;
    held_payment?: { amount?: number | null; posted?: boolean | null } | null;
  }>(
    auth,
    `purchases?select=id,purchase_number,total_amount,supplier_id,created_by,created_at,verified_by,verified_at,reviewed_at,review_status,status,held_payment&id=eq.${item.itemId}&limit=1`,
    fetchImpl,
  );
  if (!row.ok || !row.rows[0]?.id) return { ...base, partyLabel: "Supplier", note: row.ok ? "Ye purchase nahi mili." : row.message };
  const purchase = row.rows[0];
  const supplier = purchase.supplier_id && ID.test(purchase.supplier_id)
    ? await liveGet<{ name?: string | null }>(auth, `suppliers?select=name&id=eq.${purchase.supplier_id}&limit=1`, fetchImpl)
    : null;
  const names = await profileNames(auth, [purchase.created_by || "", purchase.verified_by || ""], fetchImpl);
  const creator = purchase.created_by
    ? await liveGet<{ role?: string | null }>(auth, `profiles?select=role&id=eq.${purchase.created_by}&limit=1`, fetchImpl)
    : null;
  return {
    ...base,
    partyLabel: "Supplier",
    party: (supplier?.ok ? supplier.rows[0]?.name : null) || item.title || purchase.purchase_number || "Supplier",
    quantity: purchase.purchase_number || "—",
    amount: rupeeLabel(numOrNull(purchase.total_amount)),
    steps: purchaseSteps({
      reviewStatus: purchase.review_status || null,
      requestedBy: (purchase.created_by && names.get(purchase.created_by)) || item.enteredByName,
      verifiedBy: (purchase.verified_by && names.get(purchase.verified_by)) || null,
      createdAt: purchase.created_at || null,
      verifiedAt: purchase.verified_at || null,
      reviewedAt: purchase.reviewed_at || null,
    }),
    action: "purchase",
    purchase: {
      id: purchase.id || item.itemId,
      reviewStatus: purchase.review_status || null,
      status: purchase.status || null,
      createdBy: purchase.created_by || null,
      verifiedBy: purchase.verified_by || null,
      creatorRole: creator?.ok ? creator.rows[0]?.role || null : null,
      held: purchase.held_payment ?? null,
    },
    note: creator && !creator.ok ? creator.message : null,
  };
}

export function planForRecord(input: {
  readOnly: boolean;
  actor: DeskActor;
  record: ApprovalRecord;
  decision: "approve" | "reject";
  comment: string;
  nowIso: string;
}): DeskPlan {
  const shared = {
    readOnly: input.readOnly,
    actor: input.actor,
    decision: input.decision,
    comment: input.comment,
    nowIso: input.nowIso,
  };
  if (input.record.action === "milk" && input.record.milk) return planMilkDecision({ ...shared, row: input.record.milk });
  if (input.record.action === "leave" && input.record.leave) return planLeaveDecision({ ...shared, row: input.record.leave });
  if (input.record.action === "purchase" && input.record.purchase) return planPurchaseDecision({ ...shared, row: input.record.purchase });
  return { ok: false, message: input.record.note || "Is record par phone se faisla nahi hota." };
}

export async function applyDeskDecision(
  auth: LiveAuth,
  plan: Extract<DeskPlan, { ok: true }>,
  fetchImpl: FetchLike,
  leaveProfileId?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (plan.kind === "leave") {
    if (!leaveProfileId || !ID.test(leaveProfileId)) return { ok: false, message: "Chhutti ka banda nahi mila." };
    const gate = await liveRpc<boolean>(auth, "fn_hr_can_decide_for", { p_target: leaveProfileId }, fetchImpl);
    if (!gate.ok) return { ok: false, message: gate.message };
    if (gate.data !== true) return { ok: false, message: "Ye banda aap ki reporting team mein nahi." };
  }
  const table = plan.kind === "milk" ? "milk_entries" : plan.kind === "leave" ? "leave_requests" : "purchases";
  const saved = await livePatchWhere(auth, table, plan.match, plan.patch, fetchImpl);
  if (!saved.ok) return { ok: false, message: saved.message };
  if (saved.rows.length === 0) return { ok: false, message: "Is par pehle faisla ho chuka hai, ya record ab is marhale mein nahi." };
  if (plan.kind === "purchase") {
    const comment = await liveInsert(auth, "purchase_comments", plan.comment, fetchImpl);
    if (!comment.ok) return { ok: false, message: `Faisla lag gaya. Comment nahi likha: ${comment.message}` };
  }
  return { ok: true };
}
