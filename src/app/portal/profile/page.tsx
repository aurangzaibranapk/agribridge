import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";
import { getMotivationMessage } from "@/lib/utils/motivation";
import { FarmerProfileForm, ConfirmProfileCard } from "./farmer-profile-form";
import { UsernameCard } from "./username-card";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { Hero } from "@/components/portal/dairy/dairy-parts";

const PROFILE_STATUS_LABEL: Record<string, string> = {
  basic_registered: "Registered — buniyadi tafseel",
  profile_incomplete: "Profile adhoori",
  profile_complete: "Profile mukammal (aap ne confirm ki)",
  verified: "Tasdeeq shuda",
};

export default async function FarmerProfilePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("*").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const completion = computeProfileCompletion(farmer);
  const motivation = getMotivationMessage(completion.percent);
  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-4 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      {/* Sidebar mein "My Profile" likha hai -- yahan bhi wahi naam (malik, 11 September). */}
      <Hero title={<>👤 {t("nav_profile", lang)}</>} sub={`${(farmer as any).farmer_code ?? ""} · ${motivation}`}>
        <div className="flex min-w-[220px] items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-3 py-1.5 text-xs font-semibold">
          <span>{completion.percent}% {t("percent_complete", lang)}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/25"><span className="block h-full rounded-full bg-white" style={{ width: `${completion.percent}%` }} /></span>
        </div>
      </Hero>
      <div className="pf-grow pf-grid grid gap-4 fit:grid-cols-[minmax(240px,0.85fr)_3fr] fit:gap-2.5">
        <aside className="pf-scroll space-y-3" data-testid="profile-identity">
          {completion.isComplete ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t("profile_complete_msg", lang)}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("profile_incomplete_msg", lang)}
            </div>
          )}
          {/* Darja database khud nikalta hai (migration 124) -- yahan sirf dikhaya jata hai. */}
          <p className="text-xs text-surface-400">
            Darja: {PROFILE_STATUS_LABEL[(farmer as any).profile_status] ?? (farmer as any).profile_status}
          </p>
          <UsernameCard current={(farmer as any).username ?? null} />
          <ConfirmProfileCard
            completion={completion}
            confirmedAt={(farmer as any).profile_confirmed_at ?? null}
            isVerified={Boolean(farmer.is_verified)}
          />
        </aside>
        <FarmerProfileForm farmer={farmer} completion={completion} lang={lang} />
      </div>
    </div>
  );
}
