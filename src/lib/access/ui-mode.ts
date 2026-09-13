import { createClient } from "@/lib/supabase/server";

export type UiMode = "simple" | "advanced";

/**
 * Simple ya Advanced (Guided ERP E). Simple = kam khane, Advanced =
 * sab. Khane chhupte hain, rok nahi -- rok database par hai. Profile
 * na mile to advanced (kuch chhupana ghalat se behtar hai).
 */
export async function getUiMode(): Promise<UiMode> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "advanced";
    const { data } = await supabase.from("profiles").select("ui_mode").eq("id", user.id).maybeSingle();
    return data?.ui_mode === "simple" ? "simple" : "advanced";
  } catch {
    return "advanced";
  }
}
