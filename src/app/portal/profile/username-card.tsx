"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { checkFarmerUsername, setFarmerUsername, type UsernameState } from "@/actions/farmer-auth";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: UsernameState = {};

/**
 * Kisan ki apni User ID.
 *
 * Ye khana MARZI ka hai. Kisan OTP se andar aa chuka hai aur us ka kaam
 * bina is ke bhi chalta rahega -- ye sirf us bande ke liye hai jo roz
 * portal kholta hai aur har dafa code ka intezar nahi karna chahta.
 *
 * "Mil sakta hai ya nahi" likhte hi batana zaroori hai. Warna banda
 * naam aur do dafa password bhar kar bhejta hai, aur tab pata chalta hai
 * ke naam kisi aur ka tha -- teenon khane dobara bharne parte hain.
 *
 * Magar wo jawab AAKHRI faisla nahi hai, aur ye baat yahan is liye
 * likhi hui hai ke koi ise "check kar liya, ab pakka hai" na samjhe:
 * do log ek hi lamhe mein wohi naam maang lein to dono ko "mil sakta
 * hai" mil chuka hoga. Asal faisla database mein hota hai, aur wahan
 * doosre ko saaf jawab milta hai.
 */
export function UsernameCard({ current }: { current: string | null }) {
  const lang = useLang();
  const router = useRouter();
  const [state, action] = useFormState(setFarmerUsername, initialState);
  const [name, setName] = useState("");
  const [hint, setHint] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, startCheck] = useTransition();

  // Refresh render ke andar nahi. Render sirf shakl banata hai; wahan
  // kaam karna har dobara banne par phir chal jata hai.
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);


  if (current) {
    return (
      <div className="rounded-card border border-surface-200 bg-white p-5">
        <h2 className="font-display text-base font-semibold text-surface-900">{t("pm_your_user_id", lang)}</h2>
        <p className="mt-2 font-mono text-lg font-semibold text-brand-700">{current}</p>
        <p className="mt-2 text-xs text-surface-500">
          Ab aap mobile aur OTP ke bajaye seedha User ID aur password se bhi login kar sakte hain. OTP wala raasta
          bhi khula hai — jo aasan lage, wohi istemal karein.
        </p>
        <p className="mt-2 text-xs text-surface-400">{t("pm_user_id_once", lang)}</p>
      </div>
    );
  }

  function checkName(value: string) {
    setName(value);
    setHint(null);
    const saaf = value.trim().toLowerCase();
    if (saaf.length < 4) return;
    startCheck(async () => {
      const res = await checkFarmerUsername(saaf);
      setHint({ ok: res.ok, text: res.ok ? "Ye naam mil sakta hai." : (res.reason ?? "Ye naam nahi mil sakta.") });
    });
  }

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5">
      <h2 className="font-display text-base font-semibold text-surface-900">{t("pm_make_user_id", lang)}</h2>
      <p className="mt-1 text-xs text-surface-500">
        Marzi ki baat hai. Bana lenge to har dafa OTP ka intezar nahi karna paRega — seedha User ID aur password se
        andar aa jayenge. Na banayein to bhi sab kuch waise hi chalta rahega.
      </p>

      <form action={action} className="mt-4 space-y-3">
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

        <div>
          <label htmlFor="username" className="mb-1 block text-xs font-medium text-surface-700">{t("pm_user_id", lang)}</label>
          <input
            id="username"
            name="username"
            required
            value={name}
            onChange={(e) => checkName(e.target.value)}
            placeholder={t("pm_eg_username", lang)}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 font-mono text-sm lowercase"
          />
          <p className="mt-1 text-[11px] text-surface-400">{t("pm_user_id_rule", lang)}</p>
          {checking && <p className="mt-1 text-[11px] text-surface-400">{t("pm_checking", lang)}</p>}
          {!checking && hint && (
            <p className={`mt-1 text-[11px] font-medium ${hint.ok ? "text-brand-700" : "text-red-600"}`}>
              {hint.text}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-surface-700">{t("pm_password", lang)}</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password_confirm" className="mb-1 block text-xs font-medium text-surface-700">{t("pm_password_again", lang)}</label>
            <input
              id="password_confirm"
              name="password_confirm"
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <SaveBtn />
      </form>
    </div>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Ban rahi hai..." : "User ID banayein"}
    </button>
  );
}
