"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/**
 * Feature ki maloomat likhna/badalna (266). Sirf Owner/Admin. Har
 * qatar insaan ki likhi aur jaanchi hui -- AI isi se jawab dega.
 */
export interface HelpState {
  error?: string;
  success?: boolean;
}

const EDITORS = ["owner", "super_admin", "admin"];

export async function saveFeatureHelp(_prev: HelpState, formData: FormData): Promise<HelpState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !EDITORS.includes(me.role)) return { error: "Sirf Owner/Admin help likh sakta hai." };

  const key = String(formData.get("feature_key") ?? "").trim();
  const lang = String(formData.get("lang") ?? "rm");
  const purpose = String(formData.get("purpose") ?? "").trim();
  if (!key) return { error: "Feature saaf nahi." };
  if (!["rm", "en", "ur"].includes(lang)) return { error: "Zaban saaf nahi." };
  if (!purpose) return { error: "Maqsad likhna lazmi hai -- ek jumla kaafi hai." };

  const lines = (k: string) =>
    String(formData.get(k) ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  const faqRaw = lines("faq");
  // FAQ: har do satrein ek joRa -- "Q: ..." phir "A: ...". Bina Q/A ke
  // satrein sawal/jawab ki tarteeb se li jati hain.
  const faq: { q: string; a: string }[] = [];
  for (let i = 0; i + 1 < faqRaw.length; i += 2) {
    faq.push({ q: faqRaw[i].replace(/^Q:\s*/i, ""), a: faqRaw[i + 1].replace(/^A:\s*/i, "") });
  }

  const { error } = await supabase.from("feature_help").upsert(
    {
      feature_key: key,
      lang,
      purpose,
      who_uses: String(formData.get("who_uses") ?? "").trim() || null,
      when_use: String(formData.get("when_use") ?? "").trim() || null,
      how_steps: lines("how_steps"),
      next_step: String(formData.get("next_step") ?? "").trim() || null,
      mistakes: lines("mistakes"),
      video_url: String(formData.get("video_url") ?? "").trim() || null,
      faq,
      related: lines("related"),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "feature_key,lang" }
  );
  if (error) return { error: error.message };

  await logAudit({ actionType: "update", module: "platform", recordId: key, recordLabel: `Help: ${key} (${lang})`, description: "Feature ki maloomat likhi/badli" });
  revalidatePath("/admin/platform/help");
  return { success: true };
}
