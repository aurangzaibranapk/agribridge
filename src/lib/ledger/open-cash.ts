import { createServiceClient } from "@/lib/supabase/service";

/** Jama + verify ka clock. Bhejne ke waqt se, jab tak deposit approve na ho. */
export const OPEN_CASH_HOURS = 24;
export const OPEN_CASH_CATEGORY = "cash_open";
export const OPEN_CASH_REASON =
  "24 ghante mein jama aur verify nahi hua — q nahi jama hua / verify hua?";

export type OpenCashStage =
  | "awaiting_wasoli"
  | "with_manager"
  | "awaiting_deposit"
  | "awaiting_verify"
  | "settled";

export type DepositMark = "none" | "pending" | "approved" | "rejected";

export function classifyOpenCash(input: {
  status: string;
  sentAt: string;
  receiverRole: string | null;
  deposit: DepositMark;
  now?: number;
}): { stage: OpenCashStage; overdue: boolean; stuck: string } {
  if (input.deposit === "approved") {
    return { stage: "settled", overdue: false, stuck: "Jama aur verify ho gaya" };
  }
  const sent = new Date(input.sentAt).getTime();
  const overdue = Number.isFinite(sent) && (input.now ?? Date.now()) - sent >= OPEN_CASH_HOURS * 3_600_000;
  if (input.deposit === "pending") {
    return {
      stage: "awaiting_verify",
      overdue,
      stuck: overdue ? "24 ghante — jama verify nahi hua" : "Jama slip — verify baqi",
    };
  }
  if (input.status === "sent") {
    return {
      stage: "awaiting_wasoli",
      overdue,
      stuck: overdue ? "24 ghante — wasoli nahi hui" : "Wasoli baqi",
    };
  }
  if (input.receiverRole === "manager") {
    return {
      stage: "with_manager",
      overdue,
      stuck: overdue ? "24 ghante — Manager ke paas, jama nahi" : "Manager ke paas — jama baqi",
    };
  }
  return {
    stage: "awaiting_deposit",
    overdue,
    stuck: overdue ? "24 ghante — jama nahi hua" : "Jama baqi",
  };
}

export function openCashHolder(input: {
  stage: OpenCashStage;
  toName: string | null;
  receivedByName: string | null;
}): string {
  if (input.stage === "awaiting_wasoli") return input.toName ?? "Lene wala";
  if (input.stage === "settled") return "Bank / Finance verify";
  return input.receivedByName ?? input.toName ?? "Zimmedar";
}

export function hoursHeld(sentAt: string, now = Date.now()): number {
  const sent = new Date(sentAt).getTime();
  if (!Number.isFinite(sent)) return 0;
  return Math.max(0, Math.floor((now - sent) / 3_600_000));
}

export function openCashTimelineNote(input: {
  sender: string | null;
  holder: string;
  shop: string | null;
  shift: string | null;
  amount: number;
  sentAt: string;
  hours: number;
}): string {
  const shop = input.shop ?? "shop darj nahi";
  const shift = input.shift ?? "shift darj nahi";
  return `${input.sender ?? "Bhejne wala"} ne ${input.sentAt} par Rs ${Math.round(input.amount).toLocaleString("en-PK")} bheja (${shop}, ${shift}). Ab ${input.holder} ke paas ${input.hours} ghante se.`;
}

export interface OpenCashRow {
  id: string;
  amount: number;
  sentAt: string;
  shop: string | null;
  shift: string | null;
  sender: string | null;
  holder: string;
  stage: OpenCashStage;
  stuck: string;
  overdue: boolean;
  hours: number;
  fromProfileId: string | null;
}

type HandoverRaw = {
  id: string;
  amount_sent: number;
  status: string;
  sent_at: string;
  from_profile_id: string | null;
  to_profile_id: string | null;
  received_by: string | null;
  shift_id: string | null;
};

function bestDeposit(statuses: string[]): DepositMark {
  if (statuses.includes("approved")) return "approved";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("rejected")) return "rejected";
  return "none";
}

export async function loadOpenCash(now = Date.now()): Promise<OpenCashRow[]> {
  const service = createServiceClient();
  const { data: handovers, error } = await service
    .from("cash_handovers")
    .select("id, amount_sent, status, sent_at, from_profile_id, to_profile_id, received_by, shift_id")
    .in("status", ["sent", "received", "short"])
    .order("sent_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (handovers ?? []) as HandoverRaw[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const shiftIds = rows.map((r) => r.shift_id).filter((id): id is string => !!id);
  const profileIds = [
    ...new Set(rows.flatMap((r) => [r.from_profile_id, r.to_profile_id, r.received_by].filter((id): id is string => !!id))),
  ];

  const [{ data: byHandover }, { data: byShift }, { data: profiles }] = await Promise.all([
    service.from("pos_shifts").select("id, shift_number, cash_handover_id, counter_id").in("cash_handover_id", ids),
    shiftIds.length
      ? service.from("pos_shifts").select("id, shift_number, cash_handover_id, counter_id").in("id", shiftIds)
      : Promise.resolve({ data: [] as { id: string; shift_number: string | null; cash_handover_id: string | null; counter_id: string | null }[] }),
    profileIds.length
      ? service.from("profiles").select("id, full_name, role").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; role: string }[] }),
  ]);

  const shifts = [...(byHandover ?? []), ...(byShift ?? [])];
  const shiftByHandover = new Map<string, { id: string; shift_number: string | null; counter_id: string | null }[]>();
  for (const s of shifts) {
    const key = s.cash_handover_id;
    if (!key) continue;
    const list = shiftByHandover.get(key) ?? [];
    if (!list.some((x) => x.id === s.id)) list.push(s);
    shiftByHandover.set(key, list);
  }
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  for (const h of rows) {
    if (h.shift_id && shiftById.has(h.shift_id) && !(shiftByHandover.get(h.id) ?? []).some((s) => s.id === h.shift_id)) {
      const s = shiftById.get(h.shift_id)!;
      const list = shiftByHandover.get(h.id) ?? [];
      list.push(s);
      shiftByHandover.set(h.id, list);
    }
  }

  const counterIds = [...new Set(shifts.map((s) => s.counter_id).filter((id): id is string => !!id))];
  const allShiftIds = [...new Set(shifts.map((s) => s.id))];
  const [{ data: counters }, { data: deposits }] = await Promise.all([
    counterIds.length
      ? service.from("pos_counters").select("id, shop_id").in("id", counterIds)
      : Promise.resolve({ data: [] as { id: string; shop_id: string | null }[] }),
    allShiftIds.length
      ? service.from("pos_collection_deposits").select("shift_id, status").in("shift_id", allShiftIds)
      : Promise.resolve({ data: [] as { shift_id: string | null; status: string }[] }),
  ]);
  const shopIds = [...new Set((counters ?? []).map((c) => c.shop_id).filter((id): id is string => !!id))];
  const { data: shops } = shopIds.length
    ? await service.from("shops").select("id, name").in("id", shopIds)
    : { data: [] as { id: string; name: string }[] };
  const shopName = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const counterShop = new Map((counters ?? []).map((c) => [c.id, c.shop_id ? shopName.get(c.shop_id) ?? null : null]));
  const depositByShift = new Map<string, string[]>();
  for (const d of deposits ?? []) {
    if (!d.shift_id) continue;
    const list = depositByShift.get(d.shift_id) ?? [];
    list.push(d.status);
    depositByShift.set(d.shift_id, list);
  }
  const profile = new Map((profiles ?? []).map((p) => [p.id, p]));

  const open: OpenCashRow[] = [];
  for (const h of rows) {
    const linked = shiftByHandover.get(h.id) ?? [];
    const deposit = bestDeposit(linked.flatMap((s) => depositByShift.get(s.id) ?? []));
    const receiver = h.received_by ? profile.get(h.received_by) : null;
    const classified = classifyOpenCash({
      status: h.status,
      sentAt: h.sent_at,
      receiverRole: receiver?.role ?? null,
      deposit,
      now,
    });
    if (classified.stage === "settled") continue;
    const toName = h.to_profile_id ? profile.get(h.to_profile_id)?.full_name ?? null : null;
    const receivedByName = receiver?.full_name ?? null;
    const shop = linked.map((s) => (s.counter_id ? counterShop.get(s.counter_id) : null)).find((n) => !!n) ?? null;
    const shift = linked.map((s) => s.shift_number).filter(Boolean).join(", ") || null;
    open.push({
      id: h.id,
      amount: Number(h.amount_sent),
      sentAt: h.sent_at,
      shop,
      shift,
      sender: h.from_profile_id ? profile.get(h.from_profile_id)?.full_name ?? null : null,
      holder: openCashHolder({ stage: classified.stage, toName, receivedByName }),
      stage: classified.stage,
      stuck: classified.stuck,
      overdue: classified.overdue,
      hours: hoursHeld(h.sent_at, now),
      fromProfileId: h.from_profile_id,
    });
  }
  return open;
}

type Loose = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          is: (col: string, val: null) => Promise<{ data: { item_id: string }[] | null; error: { message: string } | null }>;
          maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

/**
 * 713 wali tables. Nayi migration nahi. pg_cron sirf fn_pending_escalate
 * chalata hai, is liye ye HTTP cron aur Admin/Owner ke Cash Handover
 * safhe se chalti hai. Dobara notify nahi — escalated event ek dafa.
 */
export async function escalateOpenCash(now = Date.now()): Promise<{ escalated: number; closed: number }> {
  const open = await loadOpenCash(now);
  const service = createServiceClient() as unknown as Loose;
  let escalated = 0;
  const openIds = new Set(open.map((r) => r.id));

  for (const row of open) {
    if (!row.overdue) continue;
    const itemId = row.id;
    await service.from("pending_escalation_state").upsert(
      {
        category: OPEN_CASH_CATEGORY,
        item_id: itemId,
        level: "escalated",
        opened_at: row.sentAt,
        level_since: new Date(now).toISOString(),
        maker_id: row.fromProfileId,
        escalated_at: new Date(now).toISOString(),
        closed_at: null,
      },
      { onConflict: "category,item_id" },
    );
    const existing = await service
      .from("pending_escalation_events")
      .select("id")
      .eq("category", OPEN_CASH_CATEGORY)
      .eq("item_id", itemId)
      .maybeSingle();
    if (existing.data) continue;
    const note = openCashTimelineNote({
      sender: row.sender,
      holder: row.holder,
      shop: row.shop,
      shift: row.shift,
      amount: row.amount,
      sentAt: row.sentAt,
      hours: row.hours,
    });
    const inserted = await service.from("pending_escalation_events").insert({
      category: OPEN_CASH_CATEGORY,
      item_id: itemId,
      kind: "escalated",
      from_level: "manager",
      to_level: "escalated",
      reason: OPEN_CASH_REASON,
      note,
      waited_seconds: row.hours * 3600,
    });
    if (inserted.error) continue;
    const serviceDb = createServiceClient();
    const { data: people } = await serviceDb
      .from("profiles")
      .select("id")
      .in("role", ["admin", "owner", "super_admin"])
      .eq("is_active", true);
    const ids = (people ?? []).map((p) => p.id);
    if (ids.length > 0) {
      await serviceDb.from("notifications").insert(
        ids.map((id) => ({
          recipient_user_id: id,
          title: "Cash 24 ghante se jama nahi",
          message: `${OPEN_CASH_REASON} ${note}`,
          link_url: "/admin/cash-handover#open-cash",
        })),
      );
    }
    escalated += 1;
  }

  const state = await service
    .from("pending_escalation_state")
    .select("item_id")
    .eq("category", OPEN_CASH_CATEGORY)
    .eq("level", "escalated")
    .is("closed_at", null);
  let closed = 0;
  for (const st of state.data ?? []) {
    if (openIds.has(st.item_id)) continue;
    const updated = await service
      .from("pending_escalation_state")
      .update({ closed_at: new Date(now).toISOString() })
      .eq("category", OPEN_CASH_CATEGORY)
      .eq("item_id", st.item_id);
    if (!updated.error) closed += 1;
  }
  return { escalated, closed };
}
