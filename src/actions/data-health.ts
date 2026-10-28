"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { BUILTIN_ASSISTANT_KEY, BUILTIN_ASSISTANT_LABEL } from "@/lib/support/agent-dispatch";
import { buildAssistantTicket } from "@/lib/data-health/assistant-ticket";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/** Watchdog abhi chalayein -- roz ke scan ka intezar kiye baghair. */
export async function scanDataHealthNow(_prev: ActionState): Promise<ActionState> {
  const guard = await requireAction("system.data_health", "view");
  if ("error" in guard) return { error: guard.error };

  const service = createServiceClient();
  const { data, error } = await service.rpc("fn_data_health_scan");
  if (error) return { error: error.message };

  const insertedCount = Array.isArray(data) ? (data[0]?.inserted_count ?? 0) : 0;

  revalidatePath("/admin/data-health");
  if (insertedCount === 0) {
    return { success: true, message: "Koi nayi cheez nahi mili. Pehle se khule masle neeche hain." };
  }
  return { success: true, message: `${insertedCount} nayi cheez mili.` };
}

/**
 * Masla dekh kar band karna -- teen mumkin faisle:
 *
 *   "Claude ko bhej do check karne"  -- staff ise ab investigate karwana
 *                                       chahta hai (status: sent_to_claude)
 *   "Theek hai, chhoड़ do"            -- dekh liya, masla nahi (dismissed)
 *   "Theek ho gaya"                  -- fix ho chuka, band karo (resolved)
 *
 * Har soorat mein wajah likhna zaroori hai -- warna "dekh liya" aur
 * "kabhi dekha hi nahi" ek jaisi qatarein reh jatin.
 */
export async function resolveDataHealthFinding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("system.data_health", "edit");
  if ("error" in guard) return { error: guard.error };

  const id = String(formData.get("finding_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!id) return { error: "Kaunsa masla, wo saaf nahi." };
  if (!["sent_to_claude", "dismissed", "resolved"].includes(status)) {
    return { error: "Faisla saaf nahi." };
  }
  if (note.length < 5) {
    return { error: "Wajah likhna zaroori hai -- kam az kam 5 harf." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const service = createServiceClient();
  const { data: finding } = await service
    .from("data_health_findings")
    .select("title, department")
    .eq("id", id)
    .maybeSingle();

  const { error } = await service
    .from("data_health_findings")
    .update({
      status,
      resolution_note: note,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: status === "resolved" ? "approve" : status === "dismissed" ? "reject" : "update",
    module: "data_health",
    recordId: id,
    recordLabel: finding?.title,
    description: `${finding?.department ?? ""}: ${status} -- ${note}`,
  });

  revalidatePath("/admin/data-health");
  const messages: Record<string, string> = {
    sent_to_claude: "Claude ke liye bhej diya -- agli Claude Code session mein ye masla utha kar theek karwa lein.",
    dismissed: "Chhoड़ diya, wajah darj ho gayi.",
    resolved: "Theek ho gaya mark kar diya.",
  };
  return { success: true, message: messages[status] };
}

/**
 * "AgriBridge Assistant ko bhej do" -- har khule masle ka ek support ticket
 * banta hai, assigned_agent=agribridge_assistant. Assistant support_tickets
 * poll karta hai. Ek masla do baar nahi jata (support_ticket_id check).
 */
export async function sendFindingsToAssistant(_prev: ActionState, formData: FormData): Promise<ActionState & { tickets?: number[] }> {
  const guard = await requireAction("system.data_health", "edit");
  if ("error" in guard) return { error: guard.error };

  const ids = Array.from(new Set(formData.getAll("finding_id").map((v) => String(v)).filter(Boolean))).slice(0, 100);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (ids.length === 0) return { error: "Kaunsa masla, wo saaf nahi." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organization nahi mili." };

  const { data: findings, error: fErr } = await service
    .from("data_health_findings")
    .select("id, title, description, department, severity, related_label, related_table, related_id, amount, finding_type, status, support_ticket_id")
    .in("id", ids);
  if (fErr) return { error: fErr.message };

  const pending = (findings ?? []).filter((f: any) => f.status === "open" && !f.support_ticket_id);
  if (pending.length === 0) return { error: "Ye masle pehle hi bheje ja chuke ya band hain." };

  const tickets: number[] = [];
  const now = new Date().toISOString();
  for (const f of pending as any[]) {
    const t = buildAssistantTicket(f, note);
    const { data: ticket, error } = await service
      .from("support_tickets")
      .insert({
        organization_id: profile.organization_id,
        reporter_id: user.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        page_url: "/admin/data-health",
        status: "assigned",
        assigned_kind: "agent",
        assigned_agent: BUILTIN_ASSISTANT_KEY,
        assignment_status: "queued",
        assigned_at: now,
      })
      .select("id, ticket_no")
      .single();
    if (error || !ticket) return { error: error?.message ?? "Ticket nahi bana.", tickets };

    await service.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: `Data Health se ${BUILTIN_ASSISTANT_LABEL} ko bheja gaya.`,
    });
    await service
      .from("data_health_findings")
      .update({ status: "sent_to_assistant", support_ticket_id: ticket.id, resolution_note: note || "AgriBridge Assistant ko bheja gaya", resolved_by: user.id, resolved_at: now })
      .eq("id", f.id)
      .eq("status", "open");
    await logAudit({ actionType: "update", module: "data_health", recordId: f.id, recordLabel: f.title, description: `${f.department}: sent_to_assistant -- ticket #${ticket.ticket_no}` });
    tickets.push(Number(ticket.ticket_no));
  }

  revalidatePath("/admin/data-health");
  return {
    success: true,
    tickets,
    message: `${tickets.length} masle AgriBridge Assistant ko bhej diye — Ticket ${tickets.map((n) => `#${n}`).join(", ")}. Jawab Support Dashboard mein aayega.`,
  };
}
