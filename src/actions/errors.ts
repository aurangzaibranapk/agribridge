"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

export interface ErrorActionState {
  error?: string;
  notice?: string;
}

const ALLOWED = ["owner", "super_admin", "admin"];

/**
 * Kharabi par "hal ho gayi" ka nishan.
 *
 * Qatarein MITAI NAHI JATIN. Mita dene se ye sawal kabhi jawab nahi
 * paata ke ye masla pehle bhi aaya tha ya nahi -- aur wohi sawal sab se
 * zyada poocha jata hai jab masla dobara aata hai.
 *
 * Wajah likhna lazmi hai. "Hal ho gaya" bina wajah ke likh dena us bande
 * ke liye bekaar hai jo chhe mahine baad yehi qatar parhta hai.
 */
export async function resolveError(_prev: ErrorActionState, formData: FormData): Promise<ErrorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return { error: "Ye kaam sirf Owner ya Admin ka hai." };
  }

  const fingerprint = String(formData.get("fingerprint") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!fingerprint) return { error: "Kharabi nahi mili." };
  if (note.length < 3) return { error: "Wajah likhein — kya kiya ke ye masla khatam hua." };

  // Sirf khuli qatarein. Pehle se hal shuda par dobara nishan lagane se
  // us ki asal tareekh aur wajah mit jati.
  const { data, error } = await createServiceClient()
    .from("error_log")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolve_note: note.slice(0, 300),
    })
    .eq("fingerprint", fingerprint)
    .is("resolved_at", null)
    .select("id");

  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "admin_security",
    recordId: fingerprint.slice(0, 60),
    recordLabel: fingerprint.slice(0, 80),
    description: `Kharabi hal shuda likhi gayi: ${note.slice(0, 120)}`,
  });

  revalidatePath("/admin/errors");
  return { notice: `${(data ?? []).length} qatarein hal shuda likh di gayin.` };
}
