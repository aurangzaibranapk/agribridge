import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ActionType = "create" | "update" | "delete" | "approve" | "reject" | "login" | "logout" | "view";

interface LogAuditParams {
  actionType: ActionType;
  module: string;
  recordId?: string;
  recordLabel?: string;
  description?: string;
  /**
   * Sirf BADLE hue khane: { khana: { pehle, ab } }.
   *
   * Poori qatar likhne ka koi faida nahi -- aadmi ko phir do qataron ka
   * milan karna parta hai, aur wo koi nahi karta. Sawal hamesha ye hota
   * hai: "ye number pehle kya tha?"
   */
  changes?: Record<string, { pehle: unknown; ab: unknown }>;
}

// Central audit trail helper - any server action can call this after
// a create/update/delete/approve/reject to record WHO did WHAT, WHEN.
// Silently no-ops on failure so a logging hiccup never blocks the
// actual business action from completing.
//
// Likhai jaan boojh kar service client se hai. Audit ka poora maqsad
// ye hai ke use badla na ja sake -- is liye client ke paas is fehrist
// mein likhne ka koi rasta nahi hona chahiye (156). Kaun tha, wo neeche
// asli login se liya jata hai, form se nahi.
export async function logAudit({ actionType, module, recordId, recordLabel, description, changes }: LogAuditParams) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();

    await createServiceClient().from("audit_logs").insert({
      actor_id: user.id,
      actor_name: profile?.full_name ?? user.email ?? "Unknown",
      actor_role: profile?.role ?? null,
      action_type: actionType,
      module,
      record_id: recordId ?? null,
      record_label: recordLabel ?? null,
      description: description ?? null,
      changes: changes && Object.keys(changes).length > 0 ? changes : null,
    });
  } catch {
    // Audit logging must never break the actual action.
  }
}

/**
 * Purani aur nayi qatar ka farq -- sirf wo khane jo waqai badle.
 *
 * Khali se khali ka farq nahi ginta: form "" bhejta hai aur DB null
 * rakhta hai, aur un dono ko alag samajh lena har edit par jhoote
 * "tabdeeli" likh deta -- jis ke baad asli tabdeeli us shor mein gum
 * ho jati hai.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels?: Record<string, string>
): Record<string, { pehle: unknown; ab: unknown }> {
  const out: Record<string, { pehle: unknown; ab: unknown }> = {};
  for (const key of Object.keys(after)) {
    const wasRaw = before[key];
    const nowRaw = after[key];
    const was = wasRaw === "" || wasRaw === undefined ? null : wasRaw;
    const now = nowRaw === "" || nowRaw === undefined ? null : nowRaw;
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    out[labels?.[key] ?? key] = { pehle: was, ab: now };
  }
  return out;
}
