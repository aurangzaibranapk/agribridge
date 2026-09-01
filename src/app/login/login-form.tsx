"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { useFormState, useFormStatus } from "react-dom";
import { requestFarmerOtp, verifyFarmerOtp, loginWithUsername, type FarmerAuthState } from "@/actions/farmer-auth";
import { getRoleRedirectPath } from "@/lib/utils/roles";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.9 29.6 5 24 5c-7.7 0-14.4 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 43c5.3 0 10.1-1.8 13.7-5l-6.3-5.3c-2 1.4-4.6 2.3-7.4 2.3-5.4 0-9.9-3.6-11.5-8.5l-6.5 5C9.4 38.7 16.1 43 24 43z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-1.9 3.7-3.5 5.1l6.3 5.3C41.3 35.3 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="white">
      <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7C18.3 21.1 22 17 22 12z" />
    </svg>
  );
}


/**
 * Login ke khanon aur button ki shakl -- ek hi jagah.
 *
 * Teen alag form hain (kisan ka OTP, kisan ki User ID, aur staff ka
 * email) aur teenon ek hi darwaze par khare hain. Har ek ki apni shakl
 * likhte to wo teen alag safhe lagte -- aur banda tab par tab badalte
 * waqt yehi mehsoos karta ke wo kisi aur nizam mein aa gaya.
 */
const FIELD =
  "h-12 rounded-xl border-surface-200 bg-white px-4 text-[15px] shadow-sm placeholder:text-surface-400";
const BIG_BTN =
  "h-12 w-full rounded-xl text-[15px] font-semibold tracking-wide shadow-sm";
const SOCIAL_BTN =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-surface-200 bg-white text-sm font-medium text-surface-700 transition-colors hover:border-surface-300 hover:bg-surface-50";

export function LoginForm() {
  const lang = useLang();
  // Do side, aur taqseem KAAM ki nahi, BANDE ki hai.
  //
  // Baayen taraf wo log jo bahar se aate hain -- kisan aur gahak.
  // Daayen taraf idare ke apne log -- admin, staff aur vendor. Pehle
  // taqseem "kisan" banam "baqi sab" thi, aur us mein gahak ka koi
  // ghar nahi tha: wo "Staff" likhi hui patti par haath rakhne se
  // jhijakta tha.
  const [mode, setMode] = useState<"public" | "team">("public");

  return (
    <div className="space-y-4">
      {/* Naam bare harfon mein aur harf harf ke faasle ke sath do
          lakeeron mein toot jate the -- patti aadhi chauRai deti hai,
          takreeban 160px. Naam kaatne ke bajaye harf chhote kiye gaye:
          teenon ka zikr bhi rehta hai aur ek hi lakeer mein aa jate
          hain. */}
      <div className="flex rounded-xl bg-surface-100 p-1">
        <button
          type="button"
          onClick={() => setMode("public")}
          className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-all ${
            mode === "public"
              ? "bg-brand-600 text-white shadow"
              : "text-surface-500 hover:text-surface-700"
          }`}
        >{t("au_farmer_customer", lang)}</button>
        <button
          type="button"
          onClick={() => setMode("team")}
          className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-all ${
            mode === "team"
              ? "bg-brand-600 text-white shadow"
              : "text-surface-500 hover:text-surface-700"
          }`}
        >{t("au_admin_staff_vendor", lang)}</button>
      </div>

      {mode === "public" ? <PublicLogin /> : <PasswordLogin />}
    </div>
  );
}

/**
 * Email/User ID aur password wala darwaza.
 *
 * Ye EK hi jagah likha hai aur donon taraf istemal hota hai -- idare ke
 * apne log daayen taraf isi se aate hain, aur gahak baayen taraf isi
 * se. Do nakalein rakhte to ek din ek nakal theek hoti aur doosri
 * purani reh jati, aur us farq ka pata tab chalta jab koi andar na aa
 * pata.
 */
function PasswordLogin({ backLabel, onBack }: { backLabel?: string; onBack?: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Staff/customers sign in with a real email. Farmers who registered
    // with only a mobile number have no real email on file — their
    // account was created under a deterministic placeholder address
    // (see registerFarmer), which is reconstructed here the same way
    // whenever the identifier they type isn't an email.
    const trimmed = identifier.trim();
    const email = trimmed.includes("@") ? trimmed.toLowerCase() : `${trimmed.replace(/\D/g, "")}@phone.agribridge.local`;

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message === "Invalid login credentials" ? "Ghalat email ya password." : signInError.message);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();

    if (!profile) {
      setLoading(false);
      setError("Account setup adhoora hai. Support se rabta karein.");
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Ye account deactivate ho chuka hai. Admin se rabta karein.");
      return;
    }

    // One login for everyone (staff, farmer, customer) — same account, same
    // form. Where they land next depends only on profiles.role.
    const redirectTo = searchParams.get("redirectTo");
    router.push(redirectTo && redirectTo !== "/login" ? redirectTo : getRoleRedirectPath(profile.role));
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "facebook") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

        <div>
          <Label htmlFor="identifier">{t("au_email_or_mobile", lang)}</Label>
          <Input
            id="identifier"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t("au_eg_email", lang)}
            className={FIELD}
          />
        </div>

        <div>
          <Label htmlFor="password">{t("pm_password", lang)}</Label>
          <PasswordInput
            id="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={FIELD}
          />
          {/* Ye link ab khane ke NEECHE aur daayen taraf hai.
              Pehle wo "Password" ke naam ke barabar mein khara tha
              aur dono ek doosre se tang lagte the. */}
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs font-medium text-[#1E4A2E] hover:underline">{t("au_forgot_password", lang)}</Link>
          </div>
        </div>

        <Button type="submit" disabled={loading} className={BIG_BTN}>
          {loading ? "Sign in ho raha hai..." : "Sign in"}
        </Button>
      </form>

      {/* Google aur Facebook NEECHE hain, upar nahi.
          Yahan aane wale ke paas aksar apna email hota hai -- wohi asal
          raasta hai. Us ke upar do bare rangeen button rakhna asal
          raaste ko chhota kar deta tha. */}
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-200" />
        <span className="text-xs font-medium text-surface-400">{t("au_or", lang)}</span>
        <div className="h-px flex-1 bg-surface-200" />
      </div>

      <div className="mt-4 space-y-2.5">
        <button type="button" onClick={() => handleOAuth("google")} className={SOCIAL_BTN}>
          <GoogleIcon />{t("au_with_google", lang)}</button>
        <button type="button" onClick={() => handleOAuth("facebook")} className={SOCIAL_BTN}>
          <FacebookIcon />{t("au_with_facebook", lang)}</button>
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
        >
          {backLabel ?? "Wapas"}
        </button>
      )}
    </>
  );
}

/**
 * Bahar se aane walon ka darwaza -- kisan aur gahak.
 *
 * PEHLI cheez kisan ka raasta hai: mobile aur OTP. Ye jaan boojh kar
 * hai -- kisan sab se ziyada aata hai aur us ke paas na email hai na
 * password.
 *
 * Gahak ka raasta yahin neeche khula hai magar chhota. Us ka khata
 * email aur password se banta hai (customer, dealer, investor), aur
 * usay OTP wale khane mein bhejna ek nayi ghalti paida karta: wo
 * raasta sirf `farmers` mein dekhta hai, to gahak ka number wahan ek
 * naya KISAN bana deta -- ek hi bande ke do record, do alag hisaab.
 */
function PublicLogin() {
  const [route, setRoute] = useState<"otp" | "username" | "password">("otp");

  if (route === "username") return <FarmerUsernameLogin onBack={() => setRoute("otp")} />;
  if (route === "password") {
    return (
      <PasswordLogin
        backLabel="Kisan hain? Mobile aur OTP se login karein"
        onBack={() => setRoute("otp")}
      />
    );
  }

  return <FarmerOtpLogin onUsername={() => setRoute("username")} onPassword={() => setRoute("password")} />;
}

const emptyState: FarmerAuthState = {};

/**
 * Kisan ka darwaza -- mobile, phir OTP.
 *
 * Naya kisan aur purana kisan ke liye ALAG safha nahi hai. Number
 * daalte hi maloom ho jata hai ke ye number kis ka hai: purana hai to
 * us ka naam saamne aa jata hai, naya hai to sirf naam aur gaon poochh
 * liya jata hai. Kisan ke liye dono soorton mein kaam ek hi hai --
 * number likho, code likho, andar.
 */
function FarmerOtpLogin({ onUsername, onPassword }: { onUsername: () => void; onPassword: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [askState, askAction] = useFormState(requestFarmerOtp, emptyState);
  const [checkState, checkAction] = useFormState(verifyFarmerOtp, emptyState);

  const sent = askState.otpSent || checkState.otpSent;
  const needsProfile = checkState.needsProfile ?? askState.needsProfile ?? false;
  const knownName = askState.knownName;

  // Redirect ko render ke andar rakhna React ke usool ke khilaf hai --
  // render sirf shakl banata hai, kaam nahi karta. Us jagah ye chalta
  // to har dobara banne par phir chalta.
  useEffect(() => {
    if (checkState.success) {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }, [checkState.success, router]);

  if (!sent) {
    return (
      <>
      <form action={askAction} className="space-y-4">
        {askState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{askState.error}</p>}
        <div>
          <Label htmlFor="phone">{t("c_mobile_number", lang)}</Label>
          <Input
            id="phone"
            name="phone"
            required
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0300 1234567"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-surface-400">{t("au_otp_channel", lang)}</p>
        </div>
        <SubmitBtn label={t("au_send_otp", lang)} busy="Bheja ja raha hai..." />
      </form>
      {/* Do chhote raaste, dono jaan boojh kar OTP ke NEECHE.
          User ID kisan ka apna banaya hua naam hai (198) -- naye kisan
          ke paas hota hi nahi, is liye usay pehle dikhana usay wahin
          rok deta.
          Gahak ka khata email aur password se banta hai; usay upar wale
          khane mein bhejna ek naya KISAN bana deta. */}
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onUsername}
          className="w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
        >{t("au_have_user_id", lang)}</button>
        <button
          type="button"
          onClick={onPassword}
          className="w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
        >{t("au_customer_email_login", lang)}</button>
      </div>
      </>
    );
  }

  return (
    <div>
      <form action={checkAction} className="space-y-4">
        {(checkState.error || askState.error) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{checkState.error ?? askState.error}</p>
      )}
      {askState.sentVia && !checkState.error && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Code {askState.sentVia === "whatsapp" ? "WhatsApp" : "SMS"} par bhej diya gaya
          {knownName ? ` — ${knownName}` : ""}.
        </p>
      )}

      <input type="hidden" name="phone" value={phone} />

      <div>
        <Label htmlFor="code">{t("au_six_digit_code", lang)}</Label>
        <Input
          id="code"
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="- - - - - -"
          className={`${FIELD} text-center font-mono text-xl tracking-[0.4em]`}
        />
      </div>

      {needsProfile && (
        <>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("au_first_time_number", lang)}</p>
          <div>
            <Label htmlFor="full_name">{t("au_your_name", lang)}</Label>
            <Input id="full_name" name="full_name" required placeholder={t("au_eg_name", lang)} className={FIELD} />
          </div>
          <div>
            <Label htmlFor="village">{t("au_village", lang)}</Label>
            <Input id="village" name="village" placeholder={t("au_eg_village", lang)} className={FIELD} />
          </div>
        </>
      )}

        <SubmitBtn label={t("au_go_in", lang)} busy="Check ho raha hai..." />
      </form>

      {/* Kisan ke liye "Password bhool gaye?" bemaani hai -- us ka koi
          password hai hi nahi. Us ki jagah wohi cheez jo us ke kaam ki
          hai.

          Ye apna alag form hai, us ke andar nahi: HTML mein form ke
          andar form hota hi nahi, aur browser wahan andar wala chup
          chaap gira deta hai. */}
      <form action={askAction} className="mt-3">
        <input type="hidden" name="phone" value={phone} />
        <button type="submit" className="w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline">{t("au_code_not_received", lang)}</button>
      </form>
    </div>
  );
}

function SubmitBtn({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={BIG_BTN}>
      {pending ? busy : label}
    </Button>
  );
}

/**
 * User ID aur password se login.
 *
 * Kisan ne ye khud banaya hota hai (portal ki profile par), aur ye us
 * ke liye hai jo roz aata hai. Ghalat naam aur ghalat password par
 * jumla EK HI hai -- alag jumla dena kisi ko ye bata deta ke kaunsi
 * User ID maujood hai aur kaunsi nahi, aur wo fehrist banane ka pehla
 * qadam hota hai.
 */
function FarmerUsernameLogin({ onBack }: { onBack: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const [state, action] = useFormState(loginWithUsername, emptyState);

  useEffect(() => {
    if (state.success) {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div>
      <form action={action} className="space-y-4">
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div>
          <Label htmlFor="username">{t("pm_user_id", lang)}</Label>
          <Input id="username" name="username" required autoComplete="username" placeholder={t("pm_eg_username", lang)} className={FIELD} />
        </div>
        <div>
          <Label htmlFor="fpassword">{t("pm_password", lang)}</Label>
          <PasswordInput id="fpassword" name="password" required placeholder="••••••••" className={FIELD} />
        </div>
        <SubmitBtn label={t("au_go_in", lang)} busy="Check ho raha hai..." />
      </form>
      <button
        type="button"
        onClick={onBack}
        className="mt-3 w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
      >{t("au_forgot_password_q", lang)}</button>
    </div>
  );
}
