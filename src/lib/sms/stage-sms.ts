/**
 * Caller ki shikayat ka stage SMS. Sirf call_center intake.
 * Staff ke paas bahar wala mobile nahi — unhen ye SMS nahi jati.
 * 627 ka SQL SMS nahi likhta; ye app layer queue karti hai.
 */
import { COMPLAINT_STAGE_META, complaintStageOf, type ComplaintStage } from "@/lib/support/complaint-stage";
import { drainSmsOutbox } from "@/lib/sms/outbox";

export function stageSmsBody(complaintNumber: string, stage: ComplaintStage): string {
  const meta = COMPLAINT_STAGE_META[stage];
  return `Al Rana Traders: Shikayat ${complaintNumber} ab ${meta.rm} / ${meta.en} (${meta.percent}%).`;
}

export async function enqueueCallerStageSms(
  service: {
    from: (table: string) => {
      select: (cols: string) => { eq: (col: string, value: string) => { maybeSingle: () => Promise<{ data: { id?: string; organization_id?: string | null; complaint_number?: string; caller_phone?: string | null } | null }> } };
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  },
  ticket: { id: string; intake_source?: string | null },
  stage: string,
): Promise<void> {
  if (ticket.intake_source !== "call_center") return;
  const known = complaintStageOf(stage);
  if (!known) return;
  const linked = await service.from("cc_complaints").select("id,organization_id,complaint_number,caller_phone").eq("support_ticket_id", ticket.id).maybeSingle();
  const complaint = linked.data;
  const phone = complaint?.caller_phone ?? "";
  if (!complaint?.id || !complaint.complaint_number || phone.replace(/\D/g, "").length < 10) return;
  const inserted = await service.from("cc_sms_outbox").insert({
    organization_id: complaint.organization_id ?? null,
    complaint_id: complaint.id,
    to_phone: phone,
    body: stageSmsBody(complaint.complaint_number, known),
    channel: "sms",
    status: "queued",
  });
  if (inserted.error) return;
  try { await drainSmsOutbox(); } catch { /* queue rehti hai */ }
}
