"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { requestFarmerOtp, verifyFarmerOtp, loginWithIdentifier, type FarmerAuthState, type IdentifierLoginState } from "@/actions/farmer-auth";
import { getRoleRedirectPath } from "@/lib/utils/roles";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const FIELD = "h-12 rounded-xl border-surface-200 bg-white px-3.5 text-[15px] shadow-sm outline-none transition focus:border-[#2E6840] focus:ring-2 focus:ring-[#2E6840]/10 placeholder:text-surface-400";
const BIG_BTN = "h-12 w-full rounded-xl bg-[#174B2B] text-[15px] font-semibold tracking-wide text-white shadow-sm transition hover:bg-[#123D23] disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const lang = useLang();
  const [mode, setMode] = useState<"public" | "team">("public");

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-xl border border-surface-200 bg-surface-50 p-1">
        <button type="button" onClick={() => setMode("public")} aria-pressed={mode === "public"}
          className={`rounded-lg px-2 py-2.5 text-[13px] font-semibold transition ${mode === "public" ? "bg-[#174B2B] text-white shadow-sm" : "text-surface-500 hover:bg-white hover:text-surface-800"}`}>
          {t("au_farmer_customer", lang)}
        </button>
        <button type="button" onClick={() => setMode("team")} aria-pressed={mode === "team"}
          className={`rounded-lg px-2 py-2.5 text-[13px] font-semibold transition ${mode === "team" ? "bg-[#174B2B] text-white shadow-sm" : "text-surface-500 hover:bg-white hover:text-surface-800"}`}>
          {t("au_admin_staff_vendor", lang)}
        </button>
      </div>

      <div className="mb-5">
        <p className="text-sm font-semibold text-surface-800">
          {mode === "public" ? "Kisan / Customer Login" : "Team Secure Login"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-surface-500">
          {mode === "public" ? "Mobile par OTP sab se asaan raasta hai. Email account ho to email bhi use kar sakte hain." : "Admin, staff aur vendor apni registered ID aur password se sign in karein."}
        </p>
      </div>

      {mode === "public" ? <PublicLogin /> : <PasswordLogin />}
    </div>
  );
}

const identifierEmptyState: IdentifierLoginState = {};

function PasswordLogin({ backLabel, onBack }: { backLabel?: string; onBack?: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, action] = useFormState(loginWithIdentifier, identifierEmptyState);

  useEffect(() => {
    if (!state.success) return;
    // Login se pehle jo safha khulna tha wahi jeetta hai -- role ke
    // hisaab se ghar sirf tab, jab koi khaas manzil na ho.
    const redirectTo = searchParams.get("redirectTo");
    router.push(redirectTo && redirectTo !== "/login" ? redirectTo : state.redirectPath ?? "/");
    router.refresh();
  }, [state.success, state.redirectPath, searchParams, router]);

  return (
    <>
      <form action={action} className="space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <div>
          <Label htmlFor="identifier">{t("au_email_or_mobile", lang)}</Label>
          <Input id="identifier" name="identifier" required placeholder={t("au_eg_email", lang)} className={FIELD} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="password">{t("pm_password", lang)}</Label>
            <Link href="/forgot-password" className="text-xs font-semibold text-[#1E4A2E] hover:underline">{t("au_forgot_password", lang)}</Link>
          </div>
          <PasswordInput id="password" name="password" required placeholder="••••••••" className={FIELD} />
        </div>
        <SubmitBtn label="Sign in" busy="Sign in ho raha hai..." />
      </form>
      <div className="mt-4 rounded-xl border border-[#DCE8DF] bg-[#F5F9F6] px-3 py-2.5 text-center text-xs leading-relaxed text-[#496052]">
        Secure access · Role ke mutabiq aapka dashboard khulega.
      </div>
      {onBack && <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-semibold text-[#1E4A2E] hover:underline">{backLabel ?? "Wapas"}</button>}
    </>
  );
}

function PublicLogin() {
  const [route, setRoute] = useState<"main" | "username" | "password">("main");
  if (route === "username") return <FarmerUsernameLogin onBack={() => setRoute("main")} />;
  if (route === "password") return <PasswordLogin backLabel="Mobile aur OTP wale login par wapas" onBack={() => setRoute("main")} />;
  return <PublicMainLogin onUsername={() => setRoute("username")} onPassword={() => setRoute("password")} />;
}

const emptyState: FarmerAuthState = {};

function PublicMainLogin({ onUsername, onPassword }: { onUsername: () => void; onPassword: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [askState, askAction] = useFormState(requestFarmerOtp, emptyState);
  const [checkState, checkAction] = useFormState(verifyFarmerOtp, emptyState);
  const [emailStage, setEmailStage] = useState<"none" | "sent">("none");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  /**
   * Malik (7 September): "ye second jo rukay hain wo chalna chahiye,
   * pata to chale kitna second ho gaye hain" -- pehle server ka bheja
   * hua adad ek dafa likh kar rukk jata tha, screen par ginta nahi tha.
   * Ab yahin, client par, har second kam hota hai.
   */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => setAsking(false), [askState]);
  useEffect(() => {
    if (!checkState.success) return;
    // Malik (10 September): OTP se andar aane ke baad sab se pehle wo
    // page khule jahan password aur User ID banti hai -- dashboard nahi.
    // Jis ki User ID pehle se bani hui hai us ke liye ye qadam guzar
    // chuka, seedha dashboard.
    router.push(checkState.hasUsername ? "/portal/dashboard" : "/portal/profile");
    router.refresh();
  }, [checkState.success, checkState.hasUsername, router]);
  useEffect(() => {
    if (askState.retryAfterSeconds) setCooldown(askState.retryAfterSeconds);
  }, [askState]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const usingEmail = email.trim().length > 0;
  const phoneSent = askState.otpSent || checkState.otpSent;
  const needsProfile = checkState.needsProfile ?? askState.needsProfile ?? false;
  const cooldownMessage = cooldown > 0 ? `Thora intezar karein — ${cooldown} second baad dobara bhej sakte hain.` : null;

  async function sendEmailCode(address: string) {
    setEmailBusy(true); setEmailError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    setEmailBusy(false);
    if (error) { setEmailError(/signups not allowed|not found|invalid/i.test(error.message) ? t("au_email_not_registered", lang) : error.message); return; }
    setEmailStage("sent");
  }

  async function verifyEmailCode(code: string) {
    setEmailBusy(true); setEmailError(null);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error || !data.user) { setEmailBusy(false); setEmailError(error?.message ?? "Code theek nahi."); return; }
    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();
    if (!profile || !profile.is_active) { await supabase.auth.signOut(); setEmailBusy(false); setEmailError(profile ? "Ye account deactivate ho chuka hai. Admin se rabta karein." : "Account setup adhoora hai. Support se rabta karein."); return; }
    router.push(getRoleRedirectPath(profile.role)); router.refresh();
  }

  if (emailStage === "sent") return (
    <div>
      <div className="mb-4"><StepBadge>2</StepBadge><span className="ml-2 text-sm font-semibold text-surface-800">Email code verify karein</span></div>
      <form action={(fd: FormData) => { void verifyEmailCode(String(fd.get("code") ?? "").trim()); }} className="space-y-4">
        {emailError ? <Alert tone="error">{emailError}</Alert> : <Alert>Code {email.trim()} par bhej diya gaya.</Alert>}
        <div><Label htmlFor="ecode">{t("au_six_digit_code", lang)}</Label><Input id="ecode" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="- - - - - -" className={`${FIELD} text-center font-mono text-xl tracking-[0.35em]`} /></div>
        <Button type="submit" disabled={emailBusy} className={BIG_BTN}>{emailBusy ? "Check ho raha hai..." : t("au_go_in", lang)}</Button>
      </form>
      <button type="button" onClick={() => { setEmailStage("none"); setEmailError(null); }} className="mt-3 w-full text-center text-xs font-semibold text-[#1E4A2E] hover:underline">{t("au_email_back", lang)}</button>
    </div>
  );

  if (phoneSent) return (
    <div>
      <div className="mb-4"><StepBadge>2</StepBadge><span className="ml-2 text-sm font-semibold text-surface-800">OTP verify karein</span></div>
      <form action={checkAction} className="space-y-4">
        {(checkState.error || cooldownMessage || askState.error) ? <Alert tone="error">{checkState.error ?? cooldownMessage ?? askState.error}</Alert> : <Alert>Code {askState.sentVia === "sms" ? "SMS" : "WhatsApp"} par bhej diya gaya{askState.knownName ? ` — ${askState.knownName}` : ""}.</Alert>}
        <input type="hidden" name="phone" value={phone} />
        <div><Label htmlFor="code">{t("au_six_digit_code", lang)}</Label><Input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="- - - - - -" className={`${FIELD} text-center font-mono text-xl tracking-[0.35em]`} /></div>
        {needsProfile && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><p className="text-xs font-semibold text-amber-800">{t("au_first_time_number", lang)}</p><div><Label htmlFor="full_name">{t("au_your_name", lang)}</Label><Input id="full_name" name="full_name" required placeholder={t("au_eg_name", lang)} className={FIELD} /></div><div><Label htmlFor="village">{t("au_village", lang)}</Label><Input id="village" name="village" placeholder={t("au_eg_village", lang)} className={FIELD} /></div></div>}
        <SubmitBtn label={t("au_go_in", lang)} busy="Check ho raha hai..." />
      </form>
      <form action={askAction} className="mt-3">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="channel" value={askState.sentVia === "whatsapp" ? "sms" : "whatsapp"} />
        <button type="submit" disabled={cooldown > 0} className="w-full text-center text-xs font-semibold text-[#1E4A2E] hover:underline disabled:cursor-not-allowed disabled:text-surface-400 disabled:no-underline">
          {cooldown > 0 ? `${cooldown} second mein dobara bhej sakte hain` : t("au_code_not_received", lang)}
        </button>
      </form>
    </div>
  );

  return (
    <>
      <form action={(fd: FormData) => { const typedEmail = String(fd.get("email") ?? "").trim(); if (typedEmail) { void sendEmailCode(typedEmail); return; } setAsking(true); askAction(fd); }} className="space-y-4">
        {(cooldownMessage || askState.error || emailError) && <Alert tone="error">{cooldownMessage ?? askState.error ?? emailError}</Alert>}
        <div>
          <div className="mb-1.5 flex items-center justify-between"><Label htmlFor="phone">{t("au_mobile_userid", lang)}</Label><span className="text-[11px] font-medium text-surface-400">Recommended</span></div>
          <div className="flex gap-2"><div className="flex h-12 items-center rounded-xl border border-surface-200 bg-surface-50 px-3 text-sm font-semibold text-surface-600">+92</div><Input id="phone" name="phone" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 1234567" className={`${FIELD} min-w-0 flex-1`} /></div>
          {!usingEmail && <div className="mt-2 grid grid-cols-2 gap-2"><ChannelButton active={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} icon={<WhatsAppMark />}>WhatsApp</ChannelButton><ChannelButton active={channel === "sms"} onClick={() => setChannel("sms")} icon={<SmsMark />}>SMS</ChannelButton><input type="hidden" name="channel" value={channel} /></div>}
          {!usingEmail && <p className="mt-1.5 text-center text-[11px] text-surface-400">{t("au_channel_hint", lang)}</p>}
        </div>

        <Divider label={t("au_ya", lang)} />

        <div><Label htmlFor="email">{t("au_email_userid", lang)}</Label><Input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" className={FIELD} /><p className="mt-1.5 text-[11px] leading-relaxed text-surface-400">{t("au_email_code_note", lang)}</p></div>
        <SubmitBtn
          label={t("au_send_otp", lang)}
          busy="Bheja ja raha hai..."
          pending={emailBusy || asking || cooldown > 0}
          pendingLabel={cooldown > 0 ? `${cooldown} second baad` : undefined}
        />
      </form>

      <p className="mt-4 text-center text-[13px] text-surface-600">{t("au_not_member", lang)} <Link href="/register/farmer" className="font-semibold text-[#1E4A2E] hover:underline">{t("au_register_now", lang)}</Link></p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-surface-100 pt-4"><button type="button" onClick={onUsername} className="rounded-lg px-2 py-2 text-xs font-semibold text-surface-500 hover:bg-surface-50 hover:text-[#1E4A2E]">{t("au_link_user_id", lang)}</button><button type="button" onClick={onPassword} className="rounded-lg px-2 py-2 text-xs font-semibold text-surface-500 hover:bg-surface-50 hover:text-[#1E4A2E]">{t("au_link_password", lang)}</button></div>
    </>
  );
}

function FarmerUsernameLogin({ onBack }: { onBack: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const [state, action] = useFormState(loginWithIdentifier, identifierEmptyState);
  useEffect(() => { if (state.success) { router.push(state.redirectPath ?? "/portal/dashboard"); router.refresh(); } }, [state.success, state.redirectPath, router]);
  return <div><div className="mb-4"><StepBadge>↳</StepBadge><span className="ml-2 text-sm font-semibold text-surface-800">User ID se login</span></div><form action={action} className="space-y-4">{state.error && <Alert tone="error">{state.error}</Alert>}<div><Label htmlFor="identifier">{t("pm_user_id", lang)}</Label><Input id="identifier" name="identifier" required autoComplete="username" placeholder={t("pm_eg_username", lang)} className={FIELD} /></div><div><Label htmlFor="fpassword">{t("pm_password", lang)}</Label><PasswordInput id="fpassword" name="password" required placeholder="••••••••" className={FIELD} /></div><SubmitBtn label={t("au_go_in", lang)} busy="Check ho raha hai..." /></form><button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-semibold text-[#1E4A2E] hover:underline">Mobile / OTP login par wapas</button></div>;
}

function SubmitBtn({
  label,
  busy,
  pending: extraPending = false,
  pendingLabel,
}: {
  label: string;
  busy: string;
  pending?: boolean;
  /** extraPending ki apni wajah ho (jaise cooldown) to "busy" ki jagah ye dikhta hai. */
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const waiting = pending || extraPending;
  const text = pending ? busy : extraPending ? pendingLabel ?? busy : label;
  return <Button type="submit" disabled={waiting} className={BIG_BTN}>{text}</Button>;
}

function Alert({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "error" }) {
  return <div className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${tone === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-[#DCE8DF] bg-[#F3F8F4] text-[#285239]"}`}>{children}</div>;
}

function Divider({ label }: { label: string }) { return <div className="relative py-1"><div className="absolute inset-x-0 top-1/2 h-px bg-surface-200" /><span className="relative mx-auto block w-fit bg-white px-3 text-[11px] font-semibold text-surface-400">{label}</span></div>; }

function StepBadge({ children }: { children: React.ReactNode }) { return <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#EAF3EC] px-2 text-xs font-bold text-[#174B2B]">{children}</span>; }

function ChannelButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition ${active ? "border-[#2E6840] bg-[#F0F7F2] text-[#174B2B] shadow-sm" : "border-surface-200 bg-white text-surface-500 hover:bg-surface-50"}`}>{icon}{children}</button>; }

function WhatsAppMark() { return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-[10px] font-bold text-white">W</span>; }
function SmsMark() { return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4A7856] text-[9px] font-bold text-white">SMS</span>; }
