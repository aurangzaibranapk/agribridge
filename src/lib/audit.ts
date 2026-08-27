import { createClient } from "@/lib/supabase/server";

type ActionType = "create" | "update" | "delete" | "approve" | "reject" | "login" | "logout" | "view";

interface LogAuditParams {
  actionType: ActionType;
  module: string;
  recordId?: string;
  recordLabel?: string;
  description?: string;
}

// Central audit trail helper - any server action can call this after
// a create/update/delete/approve/reject to record WHO did WHAT, WHEN.
// Silently no-ops on failure so a logging hiccup never blocks the
// actual business action from completing.
export async function logAudit({ actionType, module, recordId, recordLabel, description }: LogAuditParams) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: profile?.full_name ?? user.email ?? "Unknown",
      actor_role: profile?.role ?? null,
      action_type: actionType,
      module,
      record_id: recordId ?? null,
      record_label: recordLabel ?? null,
      description: description ?? null,
    });
  } catch {
    // Audit logging must never break the actual action.
  }
}