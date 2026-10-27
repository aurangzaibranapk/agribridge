"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { sendCash } from "@/actions/cash-handover";
import { logAudit } from "@/lib/audit";
import { staffShopOutstanding } from "@/lib/pos/collection-outstanding";
import { nextYearNumber } from "@/lib/counters";
import { canSeeCustodyPacket } from "@/lib/cash-custody/chain";
import { loadCustodyViewer, type CustodyHopRow, type CustodyPacketRow } from "@/lib/cash-custody/load";

export interface CustodyActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const DESK = new Set(["owner", "super_admin", "admin", "finance"]);

async function packetBundle(id: string) {
  const service = createServiceClient() as any;
  const { data } = await service.from("cash_custody_packets").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: hops } = await service.from("cash_custody_hops").select("holder_id, from_profile_id, to_profile_id").eq("packet_id", id);
  return { packet: data as CustodyPacketRow, hops: (hops ?? []) as Pick<CustodyHopRow, "holder_id" | "from_profile_id" | "to_profile_id">[] };
}

function involved(packet: CustodyPacketRow, hops: Pick<CustodyHopRow, "holder_id" | "from_profile_id" | "to_profile_id">[]): string[] {
  return [packet.origin_profile_id, packet.current_holder_id, packet.staff_confirmed_by, ...hops.flatMap((h) => [h.holder_id, h.from_profile_id, h.to_profile_id])].filter(
    (id): id is string => !!id
  );
}

function allowed(viewer: { userId: string; role: string; branchId: string | null }, packet: CustodyPacketRow, hops: Pick<CustodyHopRow, "holder_id" | "from_profile_id" | "to_profile_id">[]) {
  return canSeeCustodyPacket({
    role: viewer.role,
    userId: viewer.userId,
    branchId: viewer.branchId,
    packetBranchId: packet.branch_id,
    involvedProfileIds: involved(packet, hops),
  });
}

export async function confirmStaffCopy(_prev: CustodyActionState, formData: FormData): Promise<CustodyActionState> {
  const viewer = await loadCustodyViewer();
  if (!viewer) return { error: "Login karein." };
  const packetId = String(formData.get("packet_id") ?? "");
  const amount = Number(formData.get("amount") ?? NaN);
  const signature = String(formData.get("signature") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!packetId) return { error: "Slip nahi mili." };

  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("fn_cash_custody_staff_confirm", {
    p_packet: packetId,
    p_user: viewer.userId,
    p_amount: amount,
    p_signature: signature,
    p_note: note || null,
  });
  if (error) return { error: error.message };
  if (typeof data === "string" && data.trim()) return { error: data };

  await logAudit({
    actionType: "verify",
    module: "cash-custody",
    recordId: packetId,
    recordLabel: packetId,
    description: `Staff copy confirm — ${signature}, Rs ${Number.isFinite(amount) ? amount.toLocaleString() : "—"}.`,
  });
  revalidatePath(`/admin/cash-custody/packet/${packetId}`);
  revalidatePath("/admin/cash-custody");
  return { success: true, message: "Staff copy system mein confirm ho gayi. Jama copy cash ke sath rakhein." };
}

export async function forwardCustody(_prev: CustodyActionState, formData: FormData): Promise<CustodyActionState> {
  const viewer = await loadCustodyViewer();
  if (!viewer) return { error: "Login karein." };
  const packetId = String(formData.get("packet_id") ?? "");
  const toId = String(formData.get("to_profile_id") ?? "");
  if (!packetId || !toId) return { error: "Kis ko bhejna hai, wo chunein." };
  if (toId === viewer.userId) return { error: "Apne aap ko cash nahi bhej sakte." };

  const bundle = await packetBundle(packetId);
  if (!bundle) return { error: "Custody packet nahi mili." };
  if (!allowed(viewer, bundle.packet, bundle.hops)) return { error: "Ye cash aap ki nazar mein nahi." };
  if (bundle.packet.status !== "with_holder") {
    return { error: "Aage bhejne se pehle wasoli darj honi chahiye — Cash Handover slip par." };
  }
  const desk = DESK.has(viewer.role) || (viewer.role === "manager" && viewer.branchId && viewer.branchId === bundle.packet.branch_id);
  if (bundle.packet.current_holder_id !== viewer.userId && !desk) {
    return { error: "Aage wohi bhej sakta hai jis ke paas cash hai, ya Manager/Finance/Admin." };
  }

  const service = createServiceClient() as any;
  const { data: to } = await service.from("profiles").select("id, role, full_name, is_active").eq("id", toId).maybeSingle();
  if (!to?.is_active || !["finance", "manager", "admin", "owner", "super_admin"].includes(String(to.role))) {
    return { error: "Cash Finance ya Manager ke naam aage jati hai." };
  }

  const { data: wasoliHop } = await service
    .from("cash_custody_hops")
    .select("amount")
    .eq("packet_id", packetId)
    .eq("kind", "wasoli")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const moveAmount = Number(wasoliHop?.amount ?? bundle.packet.amount);
  if (!Number.isFinite(moveAmount) || moveAmount <= 0) return { error: "Aage bhejne ki raqam nahi mili." };

  const previousHandover = bundle.packet.latest_handover_id;
  const { data: claimed } = await service
    .from("cash_custody_packets")
    .update({ status: "in_transit" })
    .eq("id", packetId)
    .eq("status", "with_holder")
    .select("id");
  if (!claimed?.length) return { error: "Ye cash kisi aur ne pehle aage bhej di." };

  const fd = new FormData();
  fd.set("to_profile_id", toId);
  fd.set("amount", String(moveAmount));
  fd.set("from_source", "branch_cash");
  fd.set("transfer_method", "cash");
  fd.set("sent_note", `Custody aage — ${bundle.packet.staff_copy_number}`);
  const sent = await sendCash({} as never, fd);
  if (sent.error || !sent.handoverId) {
    let revert = service.from("cash_custody_packets").update({ status: "with_holder" }).eq("id", packetId).eq("status", "in_transit");
    revert = previousHandover ? revert.eq("latest_handover_id", previousHandover) : revert.is("latest_handover_id", null);
    await revert;
    return { error: sent.error ?? "Handover nahi bani." };
  }

  const { error: linkError } = await service
    .from("cash_handovers")
    .update({ custody_packet_id: packetId })
    .eq("id", sent.handoverId)
    .eq("status", "sent");
  if (linkError) return { error: `Cash bhej di gayi magar silsila nahi juda: ${linkError.message}` };

  await logAudit({
    actionType: "update",
    module: "cash-custody",
    recordId: packetId,
    recordLabel: bundle.packet.staff_copy_number,
    description: `Custody aage — ${to.full_name ?? toId}, Rs ${moveAmount.toLocaleString()}.`,
  });
  revalidatePath(`/admin/cash-custody/packet/${packetId}`);
  revalidatePath("/admin/cash-custody");
  revalidatePath("/admin/cash-handover");
  return { success: true, message: sent.message ?? "Aage bhej di gayi. Ab lene wale ki wasoli." };
}

export async function submitCustodyBankDeposit(_prev: CustodyActionState, formData: FormData): Promise<CustodyActionState> {
  const viewer = await loadCustodyViewer();
  if (!viewer) return { error: "Login karein." };
  const packetId = String(formData.get("packet_id") ?? "");
  const bankAccountId = String(formData.get("bank_account_id") ?? "");
  const slipUrl = String(formData.get("slip_url") ?? "").trim();
  const note = String(formData.get("staff_note") ?? "").trim();
  const depositDate = String(formData.get("deposit_date") ?? "").trim();
  if (!packetId) return { error: "Packet nahi mili." };
  if (!bankAccountId) return { error: "Bank khata chunein." };
  if (!slipUrl) return { error: "Bank slip upload karein." };
  if (!depositDate) return { error: "Jama ki tareekh likhein." };

  const bundle = await packetBundle(packetId);
  if (!bundle) return { error: "Custody packet nahi mili." };
  const packet = bundle.packet;
  if (!allowed(viewer, packet, bundle.hops)) return { error: "Ye cash aap ki nazar mein nahi." };
  if (packet.status !== "with_holder") {
    return { error: "Bank jama wasoli ke baad — pehle Cash Handover par wasoli, tab cash company ke khate mein hoti hai." };
  }
  if (!packet.shop_id || !packet.branch_id) return { error: "Is shift ki shop maloom nahi — jama nahi ho sakti." };

  const desk = DESK.has(viewer.role);
  const manager = viewer.role === "manager" && viewer.branchId === packet.branch_id;
  const holder = packet.current_holder_id === viewer.userId;
  if (!desk && !manager && !holder) return { error: "Jama wohi karaye jis ke paas cash hai, ya Manager/Finance/Admin." };

  const service = createServiceClient() as any;
  const { data: wasoliHop } = await service
    .from("cash_custody_hops")
    .select("amount")
    .eq("packet_id", packetId)
    .eq("kind", "wasoli")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const outstanding = await staffShopOutstanding(packet.origin_profile_id, packet.shop_id);
  if (!outstanding) return { error: "Is staff aur shop ka POS outstanding nahi mila — sifar mat samjhein, record nahi hai." };
  const amount = Number(wasoliHop?.amount ?? packet.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Jama ki raqam nahi mili." };
  if (amount > outstanding.outstanding + 0.01) {
    return {
      error: `Is staff ka is shop par outstanding Rs ${outstanding.outstanding.toLocaleString()} hai, packet Rs ${amount.toLocaleString()} hai. Itni jama nahi ho sakti.`,
    };
  }

  const depositNumber = await nextYearNumber("pos_deposit_counters", "DEP-");
  const { error } = await service
    .from("pos_collection_deposits")
    .insert({
      deposit_number: depositNumber,
      staff_id: packet.origin_profile_id,
      submitted_by: viewer.userId,
      shop_id: packet.shop_id,
      branch_id: outstanding.branchId,
      bank_account_id: bankAccountId,
      amount,
      deposit_date: depositDate,
      slip_url: slipUrl,
      staff_note: note || `Custody jama ${packet.staff_copy_number} — darj ${viewer.name || viewer.userId}`,
      outstanding_before: outstanding.outstanding,
      shift_id: packet.shift_id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "cash-custody",
    recordId: packetId,
    recordLabel: depositNumber,
    description: `Custody bank jama — ${depositNumber}, Rs ${amount.toLocaleString()}. Outstanding abhi kam nahi, Finance verify par kam hogi.`,
  });
  revalidatePath(`/admin/cash-custody/packet/${packetId}`);
  revalidatePath("/admin/cash-custody");
  revalidatePath("/admin/finance/pos-deposits");
  revalidatePath("/admin/my-collection");
  return { success: true, message: `${depositNumber} darj ho gayi. Finance verify kare to ye silsila band hoga.` };
}

export async function ensureCustodyPacket(formData: FormData): Promise<void> {
  const viewer = await loadCustodyViewer();
  if (!viewer) redirect("/login");
  const shiftId = String(formData.get("shift_id") ?? "");
  if (!shiftId) redirect("/admin/pos");
  const service = createServiceClient() as any;
  const { data: shift } = await service
    .from("pos_shifts")
    .select("id, staff_id, status, counted_cash, counter_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift || shift.status !== "closed" || !(Number(shift.counted_cash) > 0)) redirect("/admin/pos");
  const { data: counter } = await service.from("pos_counters").select("branch_id").eq("id", shift.counter_id).maybeSingle();
  const branchId = (counter?.branch_id as string | null) ?? null;
  const desk = DESK.has(viewer.role) || (viewer.role === "manager" && viewer.branchId && viewer.branchId === branchId);
  if (shift.staff_id !== viewer.userId && !desk) redirect("/admin/pos");

  const { data: existing } = await service.from("cash_custody_packets").select("id").eq("shift_id", shiftId).maybeSingle();
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data: opened, error } = await service.rpc("fn_cash_custody_open_shift", { p_shift: shiftId });
    if (error || !opened) redirect("/admin/pos");
    id = opened as string;
  }
  redirect(`/admin/cash-custody/packet/${id}/slip?copy=both&print=1`);
}
