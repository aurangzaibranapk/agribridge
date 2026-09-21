import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { SlipClient } from "./slip-client";

export const dynamic = "force-dynamic";

export default async function SlipPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: h } = await service
    .from("cash_handovers")
    .select("id, amount_sent, amount_received, difference, difference_reason, status, sent_note, from_source, sent_at, received_at, from_profile_id, to_profile_id, received_by")
    .eq("id", params.id)
    .maybeSingle();

  if (!h) {
    return <div className="p-8 text-center text-surface-400">Slip nahi mili.</div>;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = ["owner", "super_admin", "admin", "manager", "finance"].includes(me?.role ?? "");
  const isSender = h.from_profile_id === user.id;
  const isRecipient = h.to_profile_id === user.id;

  if (!isAdmin && !isSender && !isRecipient) {
    return <div className="p-8 text-center text-surface-400">Aap ko ye slip dekhne ki ijazat nahi.</div>;
  }

  // Sender, recipient, receiver profiles
  const profileIds = [h.from_profile_id, h.to_profile_id, h.received_by].filter(Boolean) as string[];
  const { data: profileRows } = await service
    .from("profiles")
    .select("id, full_name, role")
    .in("id", profileIds);

  const byId = new Map((profileRows ?? []).map((p) => [p.id, p]));
  const sender = byId.get(h.from_profile_id);
  const recipient = byId.get(h.to_profile_id);
  const receivedByProfile = h.received_by ? byId.get(h.received_by) : null;

  return (
    <SlipClient
      handover={{
        id: h.id,
        amountSent: Number(h.amount_sent),
        amountReceived: h.amount_received != null ? Number(h.amount_received) : null,
        difference: h.difference != null ? Number(h.difference) : null,
        differenceReason: h.difference_reason ?? null,
        status: h.status,
        sentNote: h.sent_note ?? null,
        sentAt: h.sent_at ?? null,
        receivedAt: h.received_at ?? null,
        senderName: sender?.full_name ?? "—",
        senderRole: sender?.role ?? "",
        recipientName: recipient?.full_name ?? "—",
        recipientRole: recipient?.role ?? "",
        receivedByName: receivedByProfile?.full_name ?? null,
      }}
      isRecipient={isRecipient}
      viewerName={me?.full_name ?? ""}
    />
  );
}
