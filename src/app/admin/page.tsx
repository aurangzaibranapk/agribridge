import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePageForRole } from "@/lib/departments";

export const dynamic = "force-dynamic";

/**
 * `/admin` — har bande ko us ke apne ghar par.
 *
 * =====================================================================
 * PEHLE YE TEESRE DASHBOARD PAR BHEJTA THA
 * =====================================================================
 *
 * Malik (6 September): *"Business dashboard hata do jo double hai."*
 *
 * `/admin/business-dashboard` teesra dashboard tha — menu mein tha hi
 * nahi, aur Command Center aur Master Dashboard se kuch alag kehta bhi
 * nahi tha (wohi bikri, stock, khata). Magar usay mitane se pehle YE
 * safha theek karna zaroori tha: login ke baad har banda `/admin` par
 * aata hai, aur ye usi mite hue safhe par bhej raha tha.
 *
 * Ab ye wahi karta hai jo baqi poora nizam karta hai: `homePageForRole`
 * se poochta hai ke is bande ka ghar kahan hai. Malik/Admin ke liye
 * Command Center, baqi sab ke liye "Mera Kaam" — wohi jagah jahan sirf
 * wo kaam nazar aate hain jo us ko waqai khulte hain.
 *
 * Ye do jagah ka faisla ek jagah le aata hai: menu, middleware aur ye
 * safha, teenon ab ek hi function se poochte hain.
 */
export default async function AdminIndexPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Login na ho to middleware pehle hi login par bhej chuka hota hai.
  // Phir bhi yahan mehfooz raasta rakha ja raha hai -- is safhe ka kaam
  // sirf raasta dikhana hai, rok lagana nahi.
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  redirect(homePageForRole(String(me?.role ?? "")));
}
