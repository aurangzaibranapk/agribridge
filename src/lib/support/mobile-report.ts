import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { buildAiTicketBody, postComplaintToAiAgent } from "@/lib/support/ai-agent-webhook";
import { checkAttachment, normalizeImageMime } from "@/lib/support/attachments";
import { reportDescription, reportTitle, type ReportContext } from "@/lib/mobile/report";

const VOICE = new Set(["audio/mp4", "audio/mpeg", "audio/aac", "audio/webm", "audio/wav"]);

export function voiceMime(mime: string, name: string): string | null {
  const raw = mime.toLowerCase().trim();
  if (raw === "audio/m4a" || raw === "audio/x-m4a") return "audio/mp4";
  if (VOICE.has(raw)) return raw;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "aac") return "audio/aac";
  if (ext === "wav") return "audio/wav";
  if (ext === "webm") return "audio/webm";
  return null;
}

function bytesOf(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

async function putFile(input: {
  ticketId: string;
  organizationId: string;
  userId: string;
  bytes: Buffer;
  mime: string;
  note: string;
}): Promise<{ path: string } | { error: string }> {
  const service = createServiceClient();
  const ext = input.mime === "image/jpeg" ? "jpg" : input.mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
  const path = `${input.organizationId}/${input.ticketId}/${crypto.randomUUID()}.${ext}`;
  const uploaded = await service.storage.from("support-evidence").upload(path, input.bytes, { contentType: input.mime, upsert: false });
  if (uploaded.error) return { error: uploaded.error.message };
  const db = service as unknown as {
    from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
  };
  const inserted = await db.from("support_ticket_attachments").insert({
    ticket_id: input.ticketId,
    organization_id: input.organizationId,
    uploaded_by: input.userId,
    storage_path: path,
    mime: input.mime,
    size_bytes: input.bytes.length,
    note: input.note,
  });
  if (inserted.error) return { error: inserted.error.message };
  return { path };
}

export interface FiledReport {
  id: string;
  ticket_no: number;
  intake: string;
  webhook: "sent" | "failed" | "not_configured";
}

/**
 * Tester ki report maujooda support_tickets mein.
 * intake mobile_app (698). Constraint na ho to support — dashboard ki
 * khuli fehrist phir bhi dikhati hai. Webhook tabhi jab URL set ho.
 */
export async function fileMobileReport(input: {
  userId: string;
  organizationId: string;
  fullName: string;
  text: string;
  context: ReportContext;
  screenshotBase64?: string | null;
  screenshotMime?: string | null;
  voiceBase64?: string | null;
  voiceMime?: string | null;
}): Promise<{ ok: true; ticket: FiledReport } | { ok: false; error: string }> {
  const title = reportTitle(input.context);
  const description = reportDescription(input.text, input.context);
  if (title.length < 3 || description.length < 3) return { ok: false, error: "Title aur masla likhein." };

  let shot: { bytes: Buffer; mime: string } | null = null;
  if (input.screenshotBase64) {
    const mime = normalizeImageMime(input.screenshotMime || "image/jpeg", "shot.jpg");
    const bytes = bytesOf(input.screenshotBase64);
    const problem = checkAttachment({ mime, name: "shot.jpg", size: bytes.length, existingCount: 0 });
    if (problem) return { ok: false, error: problem };
    shot = { bytes, mime };
  }
  let voice: { bytes: Buffer; mime: string } | null = null;
  if (input.voiceBase64) {
    const mime = voiceMime(input.voiceMime || "", "note.m4a");
    if (!mime) return { ok: false, error: "Awaaz MP3, M4A, AAC, WAV ya WEBM honi chahiye." };
    const bytes = bytesOf(input.voiceBase64);
    if (bytes.length <= 0 || bytes.length > 8 * 1024 * 1024) return { ok: false, error: "Awaaz 8MB se chhoti honi chahiye." };
    voice = { bytes, mime };
  }

  const service = createServiceClient();
  const db = service as any;
  const base = {
    organization_id: input.organizationId,
    reporter_id: input.userId,
    title,
    description,
    priority: "normal",
    status: "new",
    page_url: input.context.route.slice(0, 1000),
    device_info: input.context,
    complaint_stage: "received",
    stage_percent: 10,
  };

  let inserted = await db.from("support_tickets").insert({ ...base, intake_source: "mobile_app" }).select("id,ticket_no,created_at").single();
  let intake = "mobile_app";
  if (inserted.error && /intake_source|check constraint|mobile_app/i.test(inserted.error.message)) {
    inserted = await db.from("support_tickets").insert({ ...base, intake_source: "support" }).select("id,ticket_no,created_at").single();
    intake = "support";
  }
  if (inserted.error || !inserted.data) return { ok: false, error: inserted.error?.message ?? "Report mahfooz nahi hui." };

  const ticket = inserted.data as { id: string; ticket_no: number; created_at: string };
  let screenshotPath: string | null = null;
  if (shot) {
    const stored = await putFile({ ticketId: ticket.id, organizationId: input.organizationId, userId: input.userId, bytes: shot.bytes, mime: shot.mime, note: "screenshot" });
    if ("path" in stored) {
      screenshotPath = stored.path;
      await db.from("support_tickets").update({ screenshot_path: stored.path }).eq("id", ticket.id);
    }
  }
  if (voice) {
    const stored = await putFile({ ticketId: ticket.id, organizationId: input.organizationId, userId: input.userId, bytes: voice.bytes, mime: voice.mime, note: "voice" });
    if ("error" in stored) {
      await db.from("support_ticket_comments").insert({
        ticket_id: ticket.id,
        author_id: input.userId,
        body: `Awaaz nahi lagi: ${stored.error}`.slice(0, 3000),
      });
    }
  }

  const reference = `ISS-${new Date(ticket.created_at).getFullYear()}-${String(ticket.ticket_no).padStart(5, "0")}`;
  const { data: managers } = await service.from("profiles").select("id").eq("organization_id", input.organizationId).eq("is_active", true).in("role", ["owner", "super_admin", "admin"]);
  await Promise.all((managers ?? []).map((manager) =>
    notifyUser(manager.id, `${reference} · App report`, `${input.fullName}: ${title}`, "/admin/my-work/support-dashboard")
  ));

  let webhook: FiledReport["webhook"] = "not_configured";
  const shotUrl = screenshotPath
    ? (await service.storage.from("support-evidence").createSignedUrl(screenshotPath, 600)).data?.signedUrl ?? null
    : null;
  const sent = await postComplaintToAiAgent({
    payload: buildAiTicketBody({
      id: ticket.id,
      title,
      description,
      category: "mobile_app",
      screenshotUrls: shotUrl ? [shotUrl] : [],
      link: "/admin/my-work/support-dashboard",
    }),
    env: {
      AI_AGENT_WEBHOOK_URL: process.env.AI_AGENT_WEBHOOK_URL,
      AI_AGENT_WEBHOOK_SECRET: process.env.AI_AGENT_WEBHOOK_SECRET,
    },
  });
  if (sent.ok) webhook = "sent";
  else if (sent.connected) webhook = "failed";

  return { ok: true, ticket: { id: ticket.id, ticket_no: ticket.ticket_no, intake, webhook } };
}
