import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canOpenCustodyDesk, canSeeCustodyPacket, isCustodyOverdue } from "@/lib/cash-custody/chain";

export interface CustodyViewer {
  userId: string;
  role: string;
  branchId: string | null;
  name: string;
}

export interface CustodyPacketRow {
  id: string;
  shift_id: string;
  shop_id: string | null;
  branch_id: string | null;
  counter_id: string | null;
  origin_profile_id: string;
  amount: number;
  opened_at: string;
  status: string;
  current_holder_id: string | null;
  holder_since: string;
  staff_copy_number: string;
  deposit_copy_number: string;
  staff_confirmed_at: string | null;
  staff_confirmed_by: string | null;
  staff_signature: string | null;
  staff_confirmed_amount: number | null;
  staff_confirm_note: string | null;
  latest_handover_id: string | null;
  deposit_id: string | null;
  verified_at: string | null;
  alerted_at: string | null;
}

export interface CustodyHopRow {
  id: string;
  seq: number;
  kind: string;
  holder_id: string | null;
  from_profile_id: string | null;
  to_profile_id: string | null;
  handover_id: string | null;
  deposit_id: string | null;
  amount: number | null;
  note: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface CustodyBoardItem extends CustodyPacketRow {
  shopName: string | null;
  branchName: string | null;
  shiftNumber: string | null;
  originName: string | null;
  holderName: string | null;
  overdue: boolean;
}

export async function loadCustodyViewer(): Promise<CustodyViewer | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return null;
  return {
    userId: user.id,
    role: String(profile.role),
    branchId: (profile.branch_id as string | null) ?? null,
    name: (profile.full_name as string | null) ?? "",
  };
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const service = createServiceClient();
  const { data } = await service.from("profiles").select("id, full_name").in("id", unique);
  for (const row of data ?? []) map.set(row.id, row.full_name ?? "—");
  return map;
}

function idLabelMap(rows: unknown, field: "name" | "shift_number"): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: unknown; name?: unknown; shift_number?: unknown };
    const id = typeof rec.id === "string" ? rec.id : "";
    const raw = rec[field];
    const label = typeof raw === "string" ? raw : "";
    if (id && label) map.set(id, label);
  }
  return map;
}

function involvedIds(packet: CustodyPacketRow, hops: CustodyHopRow[]): string[] {
  const ids = [packet.origin_profile_id, packet.current_holder_id, packet.staff_confirmed_by];
  for (const hop of hops) ids.push(hop.holder_id, hop.from_profile_id, hop.to_profile_id);
  return ids.filter((id): id is string => !!id);
}

export async function loadCustodyBoard(viewer: CustodyViewer): Promise<{ items: CustodyBoardItem[]; error: string | null }> {
  if (!canOpenCustodyDesk(viewer.role)) return { items: [], error: null };
  const service = createServiceClient() as any;
  let query = service
    .from("cash_custody_packets")
    .select("*")
    .neq("status", "verified")
    .order("opened_at", { ascending: true })
    .limit(100);
  if (viewer.role === "manager") {
    if (!viewer.branchId) return { items: [], error: null };
    query = query.eq("branch_id", viewer.branchId);
  }
  const { data, error } = await query;
  if (error) return { items: [], error: error.message as string };
  const packets = (data ?? []) as CustodyPacketRow[];
  return { items: await decorate(packets), error: null };
}

async function decorate(packets: CustodyPacketRow[]): Promise<CustodyBoardItem[]> {
  if (packets.length === 0) return [];
  const service = createServiceClient() as any;
  const shopIds = packets.map((p) => p.shop_id).filter(Boolean);
  const branchIds = packets.map((p) => p.branch_id).filter(Boolean);
  const shiftIds = packets.map((p) => p.shift_id);
  const [{ data: shops }, { data: branches }, { data: shifts }, names] = await Promise.all([
    shopIds.length ? service.from("shops").select("id, name").in("id", shopIds) : Promise.resolve({ data: [] }),
    branchIds.length ? service.from("branches").select("id, name").in("id", branchIds) : Promise.resolve({ data: [] }),
    service.from("pos_shifts").select("id, shift_number").in("id", shiftIds),
    namesFor(packets.flatMap((p) => [p.origin_profile_id, p.current_holder_id].filter(Boolean) as string[])),
  ]);
  const shopName = idLabelMap(shops, "name");
  const branchName = idLabelMap(branches, "name");
  const shiftNumber = idLabelMap(shifts, "shift_number");
  const now = Date.now();
  return packets.map((p) => ({
    ...p,
    shopName: p.shop_id ? shopName.get(p.shop_id) ?? null : null,
    branchName: p.branch_id ? branchName.get(p.branch_id) ?? null : null,
    shiftNumber: shiftNumber.get(p.shift_id) ?? null,
    originName: names.get(p.origin_profile_id) ?? null,
    holderName: p.current_holder_id ? names.get(p.current_holder_id) ?? null : null,
    overdue: isCustodyOverdue(p.opened_at, p.verified_at, now),
  }));
}

export async function loadCustodyPacket(id: string, viewer: CustodyViewer): Promise<{
  packet: CustodyBoardItem;
  hops: (CustodyHopRow & { holderName: string | null; fromName: string | null; toName: string | null })[];
} | null> {
  const service = createServiceClient() as any;
  const { data, error } = await service.from("cash_custody_packets").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const packet = data as CustodyPacketRow;
  const { data: hopRows } = await service.from("cash_custody_hops").select("*").eq("packet_id", id).order("seq", { ascending: true });
  const hops = (hopRows ?? []) as CustodyHopRow[];
  const ids = involvedIds(packet, hops);
  if (!canSeeCustodyPacket({
    role: viewer.role,
    userId: viewer.userId,
    branchId: viewer.branchId,
    packetBranchId: packet.branch_id,
    involvedProfileIds: ids,
  })) {
    return null;
  }
  const [decorated] = await decorate([packet]);
  const names = await namesFor(ids);
  return {
    packet: decorated,
    hops: hops.map((h) => ({
      ...h,
      holderName: h.holder_id ? names.get(h.holder_id) ?? null : null,
      fromName: h.from_profile_id ? names.get(h.from_profile_id) ?? null : null,
      toName: h.to_profile_id ? names.get(h.to_profile_id) ?? null : null,
    })),
  };
}

export async function packetIdForShift(shiftId: string): Promise<string | null> {
  const service = createServiceClient() as any;
  const { data, error } = await service.from("cash_custody_packets").select("id").eq("shift_id", shiftId).maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}
