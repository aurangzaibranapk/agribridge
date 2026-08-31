import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletion } from "@/lib/utils/farmer-profile";
import { getMotivationMessage } from "@/lib/utils/motivation";
import { FarmerProfileForm, ConfirmProfileCard } from "./farmer-profile-form";
import { UsernameCard } from "./username-card";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">← {t("back_to_dashboard", lang)}</Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("complete_your_profile", lang)}</h1>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-900">
        <span className="text-sm text-surface-600">{completion.percent}% {t("percent_complete", lang)}</span>
        <div className="ml-3 h-2 flex-1 overflow-hidden rounded-full bg-surface-200">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completion.percent}%` }} />
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-brand-700">{motivation}</p>
      {completion.isComplete ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("profile_complete_msg", lang)}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t("profile_incomplete_msg", lang)}
        </div>
      )}

      {/* Darja database khud nikalta hai (migration 124) -- yahan sirf
          dikhaya jata hai. Do jagah alag alag hisaab rakhna hi wo cheez
          hai jis se ek din dono alag ho jate hain. */}
      <p className="mt-2 text-xs text-surface-400">
        Darja: {PROFILE_STATUS_LABEL[(farmer as any).profile_status] ?? (farmer as any).profile_status}
      </p>

      <div className="mt-6">
        <UsernameCard current={(farmer as any).username ?? null} />

        <FarmerProfileForm farmer={farmer} completion={completion} lang={lang} />
        <ConfirmProfileCard
          completion={completion}
          confirmedAt={(farmer as any).profile_confirmed_at ?? null}
          isVerified={Boolean(farmer.is_verified)}
        />
      </div>
    </div>
  );
}