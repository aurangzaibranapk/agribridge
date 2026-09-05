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
  "h-11 rounded-xl border-surface-200 bg-white px-3.5 text-[15px] shadow-sm placeholder:text-surface-400";
const BIG_BTN =
  "h-11 w-full rounded-xl text-[15px] font-semibold tracking-wide shadow-sm";
const SOCIAL_BTN =
  "flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white text-[13px] font-medium text-surface-700 transition-colors hover:border-surface-300 hover:bg-surface-50";

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

      <SocialButtons />

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
 * DONO USER ID EK HI SAFHE PAR. Malik ke manzoor shuda naqshe ka asal
 * nuqta yehi hai: mobile aur email dono "User ID" hain, aur banda jo
 * us ke paas hai wohi likh deta hai. Pehle email chhote se link ke
 * peeche chhupa hua tha -- gahak usay dhoondta hi nahi tha aur apna
 * number upar likh deta, jis se wo ek naya KISAN ban jata (124 ka
 * qanoon ulta pad jata: ek hi bande ke do record).
 *
 * KOI EK -- dono nahi. Email likha ho to email ka raasta chalta hai,
 * warna mobile ka. Ye faisla safhe par likha bhi hua hai, taake banda
 * andaza na lagaye.
 */
function PublicLogin() {
  const [route, setRoute] = useState<"main" | "username" | "password">("main");

  if (route === "username") return <FarmerUsernameLogin onBack={() => setRoute("main")} />;
  if (route === "password") {
    return (
      <PasswordLogin
        backLabel="Kisan hain? Mobile aur OTP se login karein"
        onBack={() => setRoute("main")}
      />
    );
  }

  return <PublicMainLogin onUsername={() => setRoute("username")} onPassword={() => setRoute("password")} />;
}

const emptyState: FarmerAuthState = {};

/* ---- Chhote nishan. Bahar se koi library nahi mangwai gayi -- ye
   chaar shaklein utni hi hain jitni chahiye thin. ---- */

function PhoneIcon() {
  return (
    <svg className="h-4 w-4 text-[#1E4A2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 text-[#1E4A2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="white">
        <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.7-4.4-3.9-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.2.6 1 1.3 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.7.8c.3.1.4.2.5.3.1.2.1.6-.1 1Z" />
      </svg>
    </span>
  );
}

function SmsMark() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4A7856]">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.7-5a8.4 8.4 0 0 1-.7-3.4 8.4 8.4 0 0 1 9-8.5 8.4 8.4 0 0 1 8 7.4Z" />
      </svg>
    </span>
  );
}

/**
 * Kisan aur gahak ka pehla safha -- dono User ID, aur raaste ka chunav.
 *
 * Naya kisan aur purana kisan ke liye ALAG safha nahi hai. Number
 * daalte hi maloom ho jata hai ke ye number kis ka hai: purana hai to
 * us ka naam saamne aa jata hai, naya hai to sirf naam aur gaon poochh
 * liya jata hai.
 *
 * EMAIL WALA RAASTA NAYA KHATA NAHI BANATA (`shouldCreateUser: false`).
 * Ye malik ka pehle ka tay shuda usool hai: "email lagi hi nahi to
 * pehle register karo". Agar yahan khata ban jata to us bande ka koi
 * kisan record hi na hota -- portal khulta magar andar kuch na hota,
 * aur ERP mein wo kahin nazar hi na aata.
 */
function PublicMainLogin({ onUsername, onPassword }: { onUsername: () => void; onPassword: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");

  const [askState, askAction] = useFormState(requestFarmerOtp, emptyState);
  const [checkState, checkAction] = useFormState(verifyFarmerOtp, emptyState);

  // Email ka raasta client par chalta hai (Supabase ka apna OTP), is
  // liye us ki apni haalat rakhni parti hai.
  const [emailStage, setEmailStage] = useState<"none" | "sent">("none");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Button ka "bheja ja raha hai" apni yaad se chalta hai.
  //
  // useFormStatus us waqt tak intezar karta hai jab tak form ka action
  // ka wada poora na ho. Yahan action ek chhota chunne wala function
  // hai jo foran laut aata hai (aage ka kaam wo shuru kara deta hai),
  // is liye wo nishan usi lamhe bujh jata -- aur banda samajhta ke
  // button dabaya hi nahi gaya, aur dobara daba deta.
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setAsking(false);
  }, [askState]);

  const usingEmail = email.trim().length > 0;
  const phoneSent = askState.otpSent || checkState.otpSent;
  const needsProfile = checkState.needsProfile ?? askState.needsProfile ?? false;
  const knownName = askState.knownName;

  useEffect(() => {
    if (checkState.success) {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }, [checkState.success, router]);

  /* ---------------- Email ka raasta ---------------- */

  async function sendEmailCode(address: string) {
    setEmailBusy(true);
    setEmailError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      // Naya khata YAHAN SE nahi banta -- upar wali wajah.
      options: { shouldCreateUser: false },
    });
    setEmailBusy(false);
    if (error) {
      // Supabase ka apna jumla angrezi mein hota hai aur banda usay
      // parh kar bhi ye nahi samajhta ke karna kya hai. Sab se aam
      // soorat -- email registered hi nahi -- ka saaf jawab yahan
      // likha hai.
      setEmailError(/signups not allowed|not found|invalid/i.test(error.message) ? t("au_email_not_registered", lang) : error.message);
      return;
    }
    setEmailStage("sent");
  }

  async function verifyEmailCode(code: string) {
    setEmailBusy(true);
    setEmailError(null);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error || !data.user) {
      setEmailBusy(false);
      setEmailError(error?.message ?? "Code theek nahi.");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();
    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      setEmailBusy(false);
      setEmailError(profile ? "Ye account deactivate ho chuka hai. Admin se rabta karein." : "Account setup adhoora hai. Support se rabta karein.");
      return;
    }
    router.push(getRoleRedirectPath(profile.role));
    router.refresh();
  }

  /* ---------------- Code maangne wala safha ---------------- */

  if (emailStage === "sent") {
    return (
      <div>
        <form
          action={(fd: FormData) => {
            void verifyEmailCode(String(fd.get("code") ?? "").trim());
          }}
          className="space-y-4"
        >
          {emailError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{emailError}</p>}
          {!emailError && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {t("au_email_code_sent", lang)} — {email.trim()}
            </p>
          )}
          <div>
            <Label htmlFor="ecode">{t("au_six_digit_code", lang)}</Label>
            <Input
              id="ecode"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="- - - - - -"
              className={`${FIELD} text-center font-mono text-xl tracking-[0.4em]`}
            />
          </div>
          <Button type="submit" disabled={emailBusy} className={BIG_BTN}>
            {emailBusy ? "Check ho raha hai..." : t("au_go_in", lang)}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setEmailStage("none");
            setEmailError(null);
          }}
          className="mt-3 w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline"
        >
          {t("au_email_back", lang)}
        </button>
      </div>
    );
  }

  if (phoneSent) {
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
            hai: code dobara.

            Ye apna alag form hai, us ke andar nahi: HTML mein form ke
            andar form hota hi nahi, aur browser wahan andar wala chup
            chaap gira deta hai.

            Dobara bhejte waqt raasta BADAL diya jata hai -- pehli dafa
            WhatsApp gaya to ab SMS. Wohi raasta dobara aazmana us bande
            ki koi madad nahi karta jis ke phone par WhatsApp chalta hi
            nahi. */}
        <form action={askAction} className="mt-3">
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="channel" value={askState.sentVia === "whatsapp" ? "sms" : "whatsapp"} />
          <button type="submit" className="w-full text-center text-xs font-medium text-[#1E4A2E] hover:underline">
            {t("au_code_not_received", lang)}
          </button>
        </form>
      </div>
    );
  }

  /* ---------------- Pehla safha ---------------- */

  // Raaste ka chunav ab BARA CARD nahi, chhoti patti hai -- aur mobile ke
  // khane ke saath juri hui.
  //
  // Do wajah. Ek: wo chunav sirf mobile par lagta hai (email par code
  // email hi par jayega), is liye us ka ghar wahi hai; alag dabbe mein
  // rakhne se wo ek nayi cheez lagta tha. Do: bare card mein naam kat
  // rahe the -- "Send o..." aur "Send b..." -- aur kata hua naam har
  // jagah kata hua hi rehta, chahe zaban koi bhi ho.
  const channelChip = (value: "whatsapp" | "sms", mark: React.ReactNode, title: string) => (
    <button
      type="button"
      onClick={() => setChannel(value)}
      aria-pressed={channel === value}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12.5px] font-medium transition-colors ${
        channel === value
          ? "border-[#1E4A2E] bg-[#F1F7F2] text-[#1E4A2E]"
          : "border-surface-200 bg-white text-surface-500 hover:border-surface-300"
      }`}
    >
      {mark}
      {title}
    </button>
  );

  return (
    <>
      <form
        action={(fd: FormData) => {
          const typedEmail = String(fd.get("email") ?? "").trim();
          if (typedEmail) {
            void sendEmailCode(typedEmail);
            return;
          }
          setAsking(true);
          askAction(fd);
        }}
        className="space-y-2.5"
      >
        {(askState.error || emailError) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{askState.error ?? emailError}</p>
        )}

        {/* ---- Mobile ---- */}
        <div>
          <Label htmlFor="phone">
            <span className="flex items-center gap-1.5">
              <PhoneIcon />
              {t("au_mobile_userid", lang)}
            </span>
          </Label>
          {/* Mulk ka code alag khane mein.
              Chunav ek hi hai (+92) magar khana phir bhi maujood hai:
              number aur code alag alag nazar aayen to banda apna number
              usi andaz mein likhta hai jaise wo phone mein para hai.
              Hisaab par is ka koi asar nahi -- phoneKey() aakhri das
              hindse leta hai, is liye 0300..., +92300... aur 300... teenon
              ek hi banda hain. */}
          <div className="flex gap-2">
            <select
              name="cc"
              defaultValue="+92"
              aria-label={t("at_country_code", lang)}
              className="h-11 shrink-0 rounded-xl border border-surface-200 bg-white px-2.5 text-[15px] text-surface-700 shadow-sm"
            >
              <option value="+92">+92</option>
            </select>
            <Input
              id="phone"
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 1234567"
              className={`${FIELD} flex-1`}
            />
          </div>
          {/* Chunav yahin, khane ke neeche. Email likha ho to ye ghayab
              ho jata hai -- us waqt sawal hi nahi banta. */}
          {!usingEmail && (
            <>
              <div className="mt-2 flex gap-1.5">
                <input type="hidden" name="channel" value={channel} />
                {channelChip("whatsapp", <WhatsAppMark />, "WhatsApp")}
                {channelChip("sms", <SmsMark />, "SMS")}
              </div>
              {/* Ye jumla pehle safhe ke sab se upar, daayen taraf ke
                  card mein khara tha -- yani us cheez se bohot door jis
                  ki wo baat kar raha hai. Banda usay tab parhta hai jab
                  code na aaye, aur us waqt us ki nazar in do khanon par
                  hoti hai, kisi door pare card par nahi. Ab wo unhi ke
                  neeche, darmiyan mein hai. */}
              <p className="mt-1.5 text-center text-[11px] leading-snug text-surface-400">
                {t("au_channel_hint", lang)}
              </p>
            </>
          )}
        </div>

        {/* ---- YA ---- */}
        <div className="relative py-0.5">
          <div className="absolute inset-x-0 top-1/2 h-px bg-surface-200" />
          <div className="relative mx-auto flex h-7 w-9 items-center justify-center rounded-full border border-surface-200 bg-white text-[11px] font-semibold text-surface-500">
            {t("au_ya", lang)}
          </div>
        </div>

        {/* ---- Email ---- */}
        <div>
          <Label htmlFor="email">
            <span className="flex items-center gap-1.5">
              <MailIcon />
              {t("au_email_userid", lang)}
            </span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className={FIELD}
          />
          <p className="mt-1 text-[11px] leading-snug text-surface-400">{t("au_email_code_note", lang)}</p>
        </div>

        {/* Dhaal wala jumla yahan se hata diya gaya. Wohi baat daayen
            taraf ke card mein pehle se likhi hai, aur do jagah likhne
            se safha lamba hota hai -- itna ke card screen se bahar
            nikal jata tha. */}
        <SubmitBtn label={t("au_send_otp", lang)} busy="Bheja ja raha hai..." icon={<SendIcon />} pending={emailBusy || asking} />
      </form>

      {/* ---- ya phir: Google / Facebook ---- */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-200" />
        <span className="text-xs font-medium text-surface-400">{t("au_or_then", lang)}</span>
        <div className="h-px flex-1 bg-surface-200" />
      </div>

      <SocialButtons />

      <p className="mt-3 text-center text-[13px] text-surface-600">
        {t("au_not_member", lang)}{" "}
        <Link href="/register" className="font-semibold text-[#1E4A2E] hover:underline">
          {t("au_register_now", lang)}
        </Link>
      </p>

      {/* Do purane raaste, jaan boojh kar sab se neeche aur sab se
          halke. User ID kisan ka apna banaya hua naam hai (198) --
          naye kisan ke paas hota hi nahi, is liye usay upar rakhna
          usay wahin rok deta. Password wala raasta us gahak ke liye
          hai jis ne khata email aur password se banaya tha. */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-surface-100 pt-2.5">
        <button type="button" onClick={onUsername} className="text-[11px] font-medium text-surface-400 hover:text-[#1E4A2E] hover:underline">
          {t("au_link_user_id", lang)}
        </button>
        <button type="button" onClick={onPassword} className="text-[11px] font-medium text-surface-400 hover:text-[#1E4A2E] hover:underline">
          {t("au_link_password", lang)}
        </button>
      </div>
    </>
  );
}

/**
 * Google aur Facebook -- EK jagah likhe hue.
 *
 * Ye dono taraf chahiye the (kisan/gahak aur admin/staff). Do nakalein
 * rakhte to ek din ek theek hoti aur doosri purani reh jati, aur us
 * farq ka pata tab chalta jab koi andar na aa pata.
 */
function SocialButtons() {
  const lang = useLang();
  const supabase = createClient();

  async function handleOAuth(provider: "google" | "facebook") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => handleOAuth("google")} className={SOCIAL_BTN}>
        <GoogleIcon />
        Google
      </button>
      <button type="button" onClick={() => handleOAuth("facebook")} className={SOCIAL_BTN}>
        <FacebookIcon />
        Facebook
      </button>
    </div>
  );
}

function SubmitBtn({
  label,
  busy,
  icon,
  pending: extraPending = false,
}: {
  label: string;
  busy: string;
  icon?: React.ReactNode;
  /** Form ke bahar chalne wala kaam (email ka raasta client par hai). */
  pending?: boolean;
}) {
  const { pending } = useFormStatus();
  const waiting = pending || extraPending;
  return (
    <Button type="submit" disabled={waiting} className={BIG_BTN}>
      <span className="flex items-center justify-center gap-2">
        {waiting ? busy : label}
        {!waiting && icon}
      </span>
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
