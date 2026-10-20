import { createServiceClient } from "@/lib/supabase/service";
import { isCallCenterRole } from "@/lib/call-center/rules";

export { isCallCenterRole };

const BLOCKED = "Call Center Agent khata, payment, rate ya koi ledger nahi likh sakta. Sirf shikayat darj hoti hai.";

/**
 * Journal ka darwaza. Profile na parh sake to yahan nahi rokte —
 * seedha likhai phir bhi DB trigger (625) par rukti hai jab session
 * agent ki ho. Service-role se agent ka createdBy milta hai to yahan rukta hai.
 */
export async function callCenterWriteBlock(profileId: string | null | undefined): Promise<string | null> {
  if (!profileId) return null;
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("profiles")
      .select("role, extra_roles")
      .eq("id", profileId)
      .maybeSingle();
    if (error || !data) return null;
    const extra = (data.extra_roles ?? []) as readonly string[];
    if (isCallCenterRole(data.role, extra)) return BLOCKED;
    return null;
  } catch {
    return null;
  }
}
