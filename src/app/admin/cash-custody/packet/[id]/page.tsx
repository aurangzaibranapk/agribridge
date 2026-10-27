import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { loadCustodyPacket, loadCustodyViewer } from "@/lib/cash-custody/load";
import { holdDuration, isCustodyOverdue, isHoldingKind, kindLabel, rs, statusLabel, whenPkt } from "@/lib/cash-custody/chain";
import { PacketActions } from "./packet-actions";

export const dynamic = "force-dynamic";

const DESK = new Set(["owner", "super_admin", "admin", "finance"]);

export default async function CustodyPacketPage({ params }: { params: { id: string } }) {
  const viewer = await loadCustodyViewer();
  if (!viewer) redirect("/login");
  const loaded = await loadCustodyPacket(params.id, viewer);
  if (!loaded) notFound();
  const { packet, hops } = loaded;
  const overdue = isCustodyOverdue(packet.opened_at, packet.verified_at);
  const service = createServiceClient() as any;
  const [{ data: finance }, { data: banks }] = await Promise.all([
    service.from("profiles").select("id, full_name, role").eq("is_active", true).in("role", ["finance", "manager"]).order("full_name"),
    service.from("finance_accounts").select("id, name").eq("account_type", "bank").order("name"),
  ]);
  const desk = DESK.has(viewer.role) || (viewer.role === "manager" && viewer.branchId === packet.branch_id);
  const isHolder = packet.current_holder_id === viewer.userId;
  const canForward = packet.status === "with_holder" && (isHolder || desk);
  const canDeposit = packet.status === "with_holder" && !!packet.shop_id && (isHolder || desk);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/cash-custody" className="text-sm text-surface-500">← Kis ke paas cash</Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900">
          {packet.shopName ?? packet.branchName ?? "Shop"} · {packet.shiftNumber ?? "Shift"}
        </h1>
        <p className="text-sm text-surface-500">
          {rs(Number(packet.amount))} · {statusLabel(packet.status)}
          {overdue ? " · 1 din se verify nahi" : ""}
        </p>
      </div>

      <div className={`rounded-card border p-4 ${overdue ? "border-red-200 bg-red-50" : "border-surface-200 bg-white"}`}>
        <p className="text-xs uppercase tracking-wide text-surface-500">Kahan se · ab kis ke paas</p>
        <p className="mt-1 text-sm text-surface-800">
          {packet.originName ?? "—"} se nikli · {whenPkt(packet.opened_at)}
        </p>
        <p className="mt-1 text-sm font-medium text-surface-900">
          Abhi: {packet.holderName ?? (packet.status === "verified" ? "Bank verify — kisi ke paas nahi" : "zimmedar darj nahi")}
          {packet.current_holder_id ? ` · ${holdDuration(packet.holder_since, null)}` : ""}
        </p>
        <p className="mt-2 text-xs text-surface-500">
          Staff slip {packet.staff_copy_number}
          {packet.staff_confirmed_at ? ` · confirm ${packet.staff_signature ?? ""}` : " · staff confirm baqi"}
          {" · "}Jama slip {packet.deposit_copy_number}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link className="rounded-lg border border-surface-200 px-2 py-1" href={`/admin/cash-custody/packet/${packet.id}/slip?copy=staff`}>Staff copy</Link>
          <Link className="rounded-lg border border-surface-200 px-2 py-1" href={`/admin/cash-custody/packet/${packet.id}/slip?copy=deposit`}>Jama copy</Link>
          <Link className="rounded-lg border border-surface-200 px-2 py-1" href={`/admin/cash-custody/packet/${packet.id}/slip?copy=both&print=1`}>Dono print</Link>
        </div>
      </div>

      <ol className="space-y-2">
        {hops.map((h) => (
          <li key={h.id} className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm">
            <p className="font-medium text-surface-900">{kindLabel(h.kind)} · {h.holderName ?? h.toName ?? "—"}</p>
            <p className="text-xs text-surface-500">
              {whenPkt(h.started_at)}
              {h.ended_at ? ` → ${whenPkt(h.ended_at)}` : ""}
              {isHoldingKind(h.kind) ? ` · ${holdDuration(h.started_at, h.ended_at)}` : ""}
            </p>
            {h.fromName && <p className="text-xs text-surface-500">{h.fromName} → {h.toName ?? h.holderName ?? "—"}</p>}
            {h.note && <p className="mt-1 text-xs text-surface-600">{h.note}</p>}
          </li>
        ))}
      </ol>

      <PacketActions
        packetId={packet.id}
        amountLabel={rs(Number(packet.amount))}
        depositDate={today}
        canForward={canForward}
        canDeposit={canDeposit}
        finance={(finance ?? []).filter((p: { id: string }) => p.id !== viewer.userId).map((p: { id: string; full_name: string | null; role: string }) => ({
          id: p.id,
          name: p.full_name ?? "—",
          role: p.role,
        }))}
        banks={(banks ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
        handoverHref={packet.status === "in_transit" && packet.latest_handover_id ? `/admin/cash-handover/slip/${packet.latest_handover_id}` : null}
      />
    </div>
  );
}
