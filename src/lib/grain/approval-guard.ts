import { requireAction } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

/**
 * Grain pending entry ka Approve / Reject / Edit -- sirf Owner, Admin, Super
 * Admin. Stock-count wali rok (requireAction ... "approve") ke UPAR role ki
 * jaanch bhi, kyunke purane raaste (legacy) wala banda requireAction se
 * guzar jata hai.
 */
export async function requireGrainApprover(): Promise<{ userId: string; role: string } | { error: string }> {
  const guard = await requireAction("grain-procurement", "approve");
  if ("error" in guard) return { error: guard.error };
  if (!UNRESTRICTED_ROLES.includes(guard.caller.role)) {
    return { error: "Sirf Owner / Admin / Super Admin grain entry Approve, Edit ya Reject kar sakte hain." };
  }
  return { userId: guard.caller.userId, role: guard.caller.role };
}
