import { createClient } from "@/lib/supabase/server";
import { cmsWriteAllowed } from "@/lib/cms/website-setting";

/** Website / CMS likhai sirf Owner, Super Admin, Admin. */
export async function assertCmsEditor(): Promise<{ userId: string } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!cmsWriteAllowed(profile?.role, profile?.is_active !== false)) {
    return { error: "Website sirf Owner ya Admin badal sakte hain." };
  }
  return { userId: user.id };
}
