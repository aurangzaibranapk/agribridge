import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyUser } from "@/lib/notifications";
import { dispatchSupportTicket, postSupportAgentComment, configuredSupportAgents } from "@/lib/support/agent-dispatch";
import { handbackTarget, resolvedRecipients, validateMemberChoice, type Department, type DeptMember } from "@/lib/support/departments";
import { canForwardComplaint } from "@/lib/support/complaint-intake";
import { enqueueCallerStageSms } from "@/lib/sms/stage-sms";

async function loadDepartments(supportDb: any, orgId: string): Promise<{ depts: Department[]; members: DeptMember[] }> {
  const { data: depts } = await supportDb.from("support_departments").select("id,name,is_default_intake,return_to_department_id,notify_scope,is_active").eq("organization_id", orgId);
  const ids = (depts ?? []).map((d: any) => d.id);
  const { data: members } = ids.length ? await supportDb.from("support_department_members").select("*").in("department_id", ids) : { data: [] };
  return { depts: (depts ?? []) as Department[], members: (members ?? []) as DeptMember[] };
}

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager", "admin_assistant"];
const MANAGERS = new Set(MANAGER_ROLES);
const STAFF_ROLES_FOR_NOTICE = ["owner", "super_admin", "admin", "manager", "sales_staff", "finance", "warehouse", "admin_assistant", "hr", "procurement", "milk_collection", "machinery", "agronomist", "ai_assistant"];
const STATUSES = new Set(["new", "assigned", "investigating", "testing", "resolved", "reopened"]);

async function notifyAudience(service: any, ticket: any, title: string, message: string) {
  const recipients = new Set<string>();
  if (ticket.reporter_id) recipients.add(ticket.reporter_id);
  if (ticket.assigned_to) recipients.add(ticket.assigned_to);
  const { data: managers } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", ticket.organization_id)
    .eq("is_active", true)
    .in("role", MANAGER_ROLES);
  for (const manager of managers ?? []) recipients.add(manager.id);
  await Promise.all(Array.from(recipients).map((id) => notifyUser(id, title, message, "/admin/my-work")));
}

function ticketReference(ticket: any) {
  const year = new Date(ticket.created_at || Date.now()).getFullYear();
  return `ISS-${year}-${String(ticket.ticket_no).padStart(5, "0")}`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const service = createServiceClient();
  const supportDb = service as any;
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return NextResponse.json({ error: "Account inactive hai." }, { status: 403 });
  const { data: ticket } = await supportDb.from("support_tickets").select("*").eq("id", params.id).maybeSingle();
  if (!ticket || ticket.organization_id !== me.organization_id) return NextResponse.json({ error: "Ticket nahi mila." }, { status: 404 });

  const body = await req.json();
  const status = String(body.status ?? "");
  const note = String(body.note ?? "").trim().slice(0, 3000);
  const canManage = MANAGERS.has(String(me.role));
  const assigneeId = String(body.assigneeId ?? "").trim();
  const agentKey = String(body.agentKey ?? "").trim().toLowerCase();
  const workflowAction = String(body.workflowAction ?? "").trim().toLowerCase();
  const isAssignee = ticket.assigned_to === user.id;
  const departmentId = String(body.departmentId ?? "").trim();
  const intake = String(ticket.intake_source ?? "");
  if (intake === "staff" || intake === "call_center") {
    const userDb = createClient() as any;
    const grantRow = String(me.role) === "manager"
      ? await supportDb.from("cc_assign_grants").select("active").eq("profile_id", user.id).maybeSingle()
      : { data: null };
    const canForward = canForwardComplaint({ role: String(me.role), managerGrant: Boolean(grantRow.data?.active) });
    const stage = String(body.stage ?? "").trim().toLowerCase();
    if (stage || (body.noteOnly && note)) {
      const moved = await userDb.rpc("fn_complaint_set_stage", {
        p_ticket: ticket.id,
        p_stage: stage || null,
        p_note: note || null,
      });
      if (moved.error) {
        const missing = /fn_complaint_set_stage|schema cache|does not exist|Could not find/i.test(moved.error.message);
        return NextResponse.json({
          error: missing ? "Complaint stages migration 627 ke baad chalte hain." : moved.error.message,
        }, { status: missing ? 503 : 400 });
      }
      if (moved.data?.changed && ticket.reporter_id && ticket.reporter_id !== user.id) {
        await notifyUser(ticket.reporter_id, "Shikayat ka stage", `${ticket.title}: ${stage}`, "/admin/my-work");
      }
      if (moved.data?.changed && intake === "call_center" && stage) {
        try { await enqueueCallerStageSms(supportDb, ticket, stage); } catch { /* SMS queue rehti hai */ }
      }
      return NextResponse.json({ success: true, message: moved.data?.changed ? "Stage update ho gaya." : "Note lag gaya." });
    }
    const routed = String(body.departmentKey ?? body.routed ?? "").trim();
    const wantAssignee = assigneeId || (body.assignToMe ? user.id : "");
    if (wantAssignee || agentKey || departmentId || routed) {
      if (!canForward) {
        return NextResponse.json({ error: "Sirf Admin assign karta hai." }, { status: 403 });
      }
      const forwarded = await userDb.rpc("fn_complaint_forward", {
        p_ticket: ticket.id,
        p_assignee: wantAssignee || null,
        p_routed: routed || null,
        p_agent_key: agentKey || null,
        p_support_department: departmentId || null,
      });
      if (forwarded.error) {
        const missing = /fn_complaint_forward|schema cache|does not exist|Could not find/i.test(forwarded.error.message);
        return NextResponse.json({
          error: missing ? "Complaint assign migration 626 ke baad chalta hai." : forwarded.error.message,
        }, { status: missing ? 503 : 400 });
      }
      if (agentKey) {
        const callbackUrl = new URL(`/api/support/tickets/${ticket.id}/agent-update`, req.url).toString();
        const dispatched = await dispatchSupportTicket(agentKey, {
          id: ticket.id, ticketNo: ticket.ticket_no, createdAt: ticket.created_at,
          title: ticket.title, description: ticket.description, priority: ticket.priority,
          pageUrl: ticket.page_url, deviceInfo: ticket.device_info, screenshotUrl: null,
        }, callbackUrl);
        if (!dispatched.ok) return NextResponse.json({ error: dispatched.error }, { status: 502 });
        await supportDb.from("support_tickets").update({
          external_task_id: dispatched.externalTaskId ?? null,
          assignment_status: dispatched.assignmentStatus ?? "analysis_requested",
          ...(dispatched.ticketStatus ? { status: dispatched.ticketStatus } : {}),
        }).eq("id", ticket.id);
        if (dispatched.message) {
          await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: dispatched.message.slice(0, 6000) });
        }

      }
      if (ticket.reporter_id && ticket.reporter_id !== user.id) {
        const label = forwarded.data?.label ? String(forwarded.data.label) : "Complaint aage bhej di.";
        await notifyUser(ticket.reporter_id, "Shikayat aage bheji gayi", `${ticket.title}: ${label}`, "/admin/my-work");
      }
      return NextResponse.json({ success: true, message: forwarded.data?.assignee ? `${forwarded.data.assignee} ko complaint mil gayi.` : "Complaint aage bhej di." });
    }
    if (status === "resolved" && ticket.reporter_id === user.id) {
      return NextResponse.json({ error: "Jis ne shikayat banayi, wo khud band nahi kar sakta." }, { status: 403 });
    }
    if (!status) return NextResponse.json({ error: "Kuch badalne ko nahi." }, { status: 400 });
    const updated = await userDb.rpc("fn_complaint_set_status", { p_ticket: ticket.id, p_status: status, p_note: note });
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    if (ticket.reporter_id && ticket.reporter_id !== user.id) {
      await notifyUser(ticket.reporter_id, "Shikayat ka stage", `${ticket.title}: ${status}`, "/admin/my-work");
    }
    return NextResponse.json({ success: true, message: "Status update ho gaya." });
  }
  if (!canManage && !(ticket.reporter_id === user.id && status === "reopened") && !(isAssignee && workflowAction === "resolve_handback")) return NextResponse.json({ error: "Ijazat nahi hai." }, { status: 403 });

  // 539: Resolve karke wapas bhejna (Admin ya reporter ki team) -- status resolved_pending_verify.
  if (workflowAction === "resolve_handback") {
    if (["resolved", "resolved_pending_verify"].includes(ticket.status)) return NextResponse.json({ error: "Ye issue pehle hi resolve ho chuka hai." }, { status: 409 });
    if (note.length < 3) return NextResponse.json({ error: "Kya theek kiya -- note likhein." }, { status: 400 });
    const { depts, members } = await loadDepartments(supportDb, me.organization_id);
    const target = handbackTarget(depts, ticket.department_id ?? null, String(body.returnToDepartmentId ?? "").trim() || null);
    if (!target) return NextResponse.json({ error: "Wapsi wala department nahi mila." }, { status: 400 });
    const agentLabel = ticket.assigned_kind === "agent" ? (configuredSupportAgents().find((a) => a.key === ticket.assigned_agent)?.label ?? ticket.assigned_agent) : null;
    const { data: actor } = await service.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      status: "resolved_pending_verify",
      handback_department_id: target.id,
      handback_note: note,
      resolved_by_kind: ticket.assigned_kind === "agent" ? "agent" : "person",
      resolved_by_label: agentLabel ?? actor?.full_name ?? null,
      resolution_note: note,
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: `Resolved → ${target.name} (verify ke liye): ${note}` });
    await supportDb.from("support_ticket_events").insert({ ticket_id: ticket.id, organization_id: me.organization_id, actor_id: user.id, event_type: "handback", from_value: ticket.status, to_value: target.name, note });
    const targetPeople = members.filter((m) => m.department_id === target.id && m.is_active && m.profile_id).map((m) => m.profile_id as string);
    const ref = ticketReference(ticket);
    await Promise.all(Array.from(new Set([...targetPeople, ticket.reporter_id].filter(Boolean))).filter((id) => id !== user.id).map((id) => notifyUser(id, `${ref} · Resolved — verify karein`, `${ticket.title}: ${note}`, "/admin/support-center")));
    return NextResponse.json({ success: true, message: `Resolved — ${target.name} ko verify ke liye bhej diya.` });
  }

  // 539: Department badalna (aur chaho to usi department ka member).
  if (canManage && departmentId) {
    const { depts, members } = await loadDepartments(supportDb, me.organization_id);
    const dept = depts.find((d) => d.id === departmentId && d.is_active);
    if (!dept) return NextResponse.json({ error: "Department nahi mila." }, { status: 400 });
    const choice = assigneeId ? { kind: "person" as const, id: assigneeId } : agentKey ? { kind: "agent" as const, key: agentKey } : { kind: "unassigned" as const };
    const bad = validateMemberChoice(members, dept.id, choice);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    if (ticket.department_id !== dept.id) {
      await supportDb.from("support_tickets").update({ department_id: dept.id, handback_department_id: null, updated_at: new Date().toISOString() }).eq("id", ticket.id);
      await supportDb.from("support_ticket_events").insert({ ticket_id: ticket.id, organization_id: me.organization_id, actor_id: user.id, event_type: "department", from_value: ticket.department_id ?? null, to_value: dept.name });
      await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: `Department: ${dept.name}` });
    }
    if (choice.kind === "unassigned") return NextResponse.json({ success: true, message: `${dept.name} ko bhej diya.` });
    ticket.department_id = dept.id;
  }

  if (canManage && workflowAction === "approve_fix") {
    if (ticket.assigned_kind !== "agent" || ticket.assignment_status !== "approval_required") {
      return NextResponse.json({ error: "Agent ka analysis aur approval request abhi complete nahi hai." }, { status: 409 });
    }
    const reference = ticketReference(ticket);
    const approvalMessage = `[AGRIBRIDGE:APPROVED:${reference}]\n\nOwner/Admin ne proposed fix approve kar diya hai. Ab approved plan ke mutabiq kaam shuru karein aur har stage ka marker post karein.`;
    const posted = await postSupportAgentComment(ticket.assigned_agent, ticket.external_task_id || "", approvalMessage);
    if (!posted.ok) return NextResponse.json({ error: posted.error }, { status: 502 });

    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assignment_status: "approved",
      status: "assigned",
      last_agent_update_at: now,
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: "Proposed fix approve kar diya gaya. Agent ko kaam shuru karne ki ijazat mil gayi.",
    });
    await notifyAudience(service, ticket, `${reference} · Fix Approved`, "Admin ne agent ka fix plan approve kar diya; work start ho raha hai.");
    return NextResponse.json({ success: true, message: "Fix approve ho gaya. Agent ko work start signal mil gaya." });
  }

  if (canManage && workflowAction === "request_changes") {
    if (ticket.assigned_kind !== "agent") return NextResponse.json({ error: "Ye agent ticket nahi hai." }, { status: 409 });
    if (!note) return NextResponse.json({ error: "Required changes likhein." }, { status: 400 });
    const reference = ticketReference(ticket);
    const changeMessage = `[AGRIBRIDGE:CHANGES_REQUESTED:${reference}]\n\nAdmin feedback:\n${note}\n\nPlan revise karein aur dobara approval request bhejein. Abhi code change na karein.`;
    const posted = await postSupportAgentComment(ticket.assigned_agent, ticket.external_task_id || "", changeMessage);
    if (!posted.ok) return NextResponse.json({ error: posted.error }, { status: 502 });

    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assignment_status: "blocked",
      status: "assigned",
      last_agent_update_at: now,
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: `Plan changes requested: ${note}` });
    await notifyAudience(service, ticket, `${reference} · Plan Revision`, "Admin ne agent se plan revise karne ko kaha hai.");
    return NextResponse.json({ success: true, message: "Agent ko plan revise karne ka feedback bhej diya." });
  }

  if (canManage && assigneeId) {
    const { data: assignee } = await service
      .from("profiles")
      .select("id,full_name,organization_id,is_active")
      .eq("id", assigneeId)
      .maybeSingle();
    if (!assignee?.is_active || assignee.organization_id !== me.organization_id) {
      return NextResponse.json({ error: "Assignee active staff member nahi mila." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assigned_to: assignee.id,
      assigned_kind: "person",
      assigned_agent: null,
      assignment_status: "queued",
      assigned_at: now,
      status: "assigned",
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: `${assignee.full_name} ko assign kiya gaya.`,
    });
    await notifyUser(assignee.id, `Support Issue ${ticketReference(ticket)}`, ticket.title, "/admin/my-work");
    await notifyUser(ticket.reporter_id, `${ticketReference(ticket)} · Assigned`, `Issue ${assignee.full_name} ko assign ho gaya.`, "/admin/my-work");
    return NextResponse.json({ success: true, message: `${assignee.full_name} ko issue mil gaya.` });
  }

  if (canManage && agentKey) {
    if (ticket.assigned_agent === agentKey && /^https:\/\/github\.com\//i.test(String(ticket.external_task_id ?? ""))) {
      return NextResponse.json({ success: true, message: "Is ticket ka GitHub/Codex task pehle se bana hua hai." });
    }
    let screenshotUrl: string | null = null;
    if (ticket.screenshot_path) {
      const signed = await service.storage.from("support-evidence").createSignedUrl(ticket.screenshot_path, 24 * 60 * 60);
      screenshotUrl = signed.data?.signedUrl ?? null;
    }
    const callbackUrl = new URL(`/api/support/tickets/${ticket.id}/agent-update`, req.url).toString();
    const dispatched = await dispatchSupportTicket(agentKey, {
      id: ticket.id,
      ticketNo: ticket.ticket_no,
      createdAt: ticket.created_at,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      pageUrl: ticket.page_url,
      deviceInfo: ticket.device_info,
      screenshotUrl,
    }, callbackUrl);
    if (!dispatched.ok) return NextResponse.json({ error: dispatched.error }, { status: 502 });
    const now = new Date().toISOString();
    const { error } = await supportDb.from("support_tickets").update({
      assigned_to: null,
      assigned_kind: "agent",
      assigned_agent: agentKey,
      assignment_status: dispatched.assignmentStatus ?? "analysis_requested",
      assigned_at: now,
      external_task_id: dispatched.externalTaskId ?? null,
      last_agent_update_at: now,
      status: dispatched.ticketStatus ?? "investigating",
      updated_at: now,
    }).eq("id", ticket.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supportDb.from("support_ticket_comments").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      body: dispatched.message || `${agentKey} agent ko analysis ke liye issue bhej diya gaya.`,
    });
    await notifyAudience(service, ticket, `${ticketReference(ticket)} · Agent Analysis`, "Issue agent ko analysis ke liye assign ho gaya. Fix se pehle Admin approval li jayegi.");
    return NextResponse.json({ success: true, message: "Agent analysis task create ho gaya. Fix approval ke baad start hogi." });
  }

  if (!STATUSES.has(status)) return NextResponse.json({ error: "Status theek nahi hai." }, { status: 400 });
  if (
    status === "resolved"
    && ticket.status !== "resolved_pending_verify"
    && ticket.assigned_kind === "agent"
    && !["testing", "fixed", "completed"].includes(String(ticket.assignment_status))
  ) {
    return NextResponse.json({ error: "Agent fix aur testing complete hone se pehle issue close nahi ho sakta." }, { status: 409 });
  }
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (canManage && body.assignToMe) {
    update.assigned_to = user.id;
    update.assigned_kind = "person";
    update.assigned_agent = null;
    update.assignment_status = "working";
    update.assigned_at = new Date().toISOString();
  }
  if (status === "resolved") { update.resolved_at = new Date().toISOString(); update.resolution_note = note || null; }
  if (status === "reopened") update.resolved_at = null;
  const { error } = await supportDb.from("support_tickets").update(update as any).eq("id", ticket.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (note) await supportDb.from("support_ticket_comments").insert({ ticket_id: ticket.id, author_id: user.id, body: note } as any);
  if (status === "resolved") {
    // 539: Verify & close -- department ki setting ke mutabiq sab staff ya reporter + team ko khabar.
    const { depts, members } = await loadDepartments(supportDb, me.organization_id);
    const dept = depts.find((d) => d.id === ticket.department_id);
    const { data: staff } = dept?.notify_scope === "all_staff"
      ? await service.from("profiles").select("id").eq("organization_id", me.organization_id).eq("is_active", true).in("role", STAFF_ROLES_FOR_NOTICE)
      : { data: [] as any[] };
    const recipients = resolvedRecipients({
      scope: dept?.notify_scope ?? "reporter_team",
      reporterId: ticket.reporter_id,
      actorId: user.id,
      assigneeId: ticket.assigned_to,
      teamProfileIds: members.filter((m) => m.department_id === ticket.department_id && m.is_active && m.profile_id).map((m) => m.profile_id as string),
      allStaffIds: (staff ?? []).map((r: any) => r.id),
    });
    const by = ticket.resolved_by_label ? ` · Hal kiya: ${ticket.resolved_by_label}${dept ? ` (${dept.name})` : ""}` : "";
    await Promise.all(recipients.map((id) => notifyUser(id, `✅ ${ticketReference(ticket)} hal ho gaya`, `${ticket.title}${by}. ${note || ticket.handback_note || ""}`.trim(), "/admin/support-center")));
    return NextResponse.json({ success: true });
  }
  await notifyAudience(service, ticket, `${ticketReference(ticket)} · ${status}`, note || `Issue status ${status} ho gaya.`);
  return NextResponse.json({ success: true });
}
