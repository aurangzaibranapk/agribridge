"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { v5CompleteSignup, v5Login, v5SendCode, v5SetPassword, v5VerifyCode, v6CheckSignup, v6NeedsUserId, v6SaveUserId, v6UserIdCheck } from "@/actions/login-v5";
import { createClient } from "@/lib/supabase/client";
import { goAfterLogin, routeAfterLogin } from "@/lib/navigation/after-login";
import { t6, type V6Lang } from "@/app/login/v6-text";
import { codeLengthFor, OTP_MAX_TRIES, OTP_RESEND_SECONDS, OTP_VALID_MINUTES } from "@/lib/auth/login-v6-ui";

/**
 * Login v6 -- design1 (malik ki manzoori, 20 Oct 2026).
 * Aik khana (User ID / email / mobile / CNIC) + password. Signup, password
 * bhool gaye (SMS 4 hindse / WhatsApp 6 hindse), naya password, aur login ke
 * baad ikhtiyari "Apni User ID banayein". Faisle server par (login-v5-flow.ts).
 */

type Step = "login" | "signup" | "forgot" | "otp" | "newpw" | "userid";
type Ch = "sms" | "whatsapp";
type Purpose = "signup" | "first_time" | "reset";
type Res = { ok: boolean; error?: string; retryAfterSeconds?: number; [k: string]: unknown };
type FieldErr = Partial<Record<"name" | "email" | "phone" | "cnic" | "password", string>>;

const INPUT_BOX = "flex h-[50px] items-center rounded-xl border-[1.5px] border-[#d3dbe2] bg-white px-3.5 transition focus-within:border-[#157a4b] focus-within:shadow-[0_0_0_4px_rgba(21,122,75,0.12)] dark:border-[#22324f] dark:bg-[#0c1629]";
const INPUT = "h-full min-w-0 flex-1 border-0 bg-transparent text-[15.5px] text-[#0d1b2e] !outline-none !ring-0 !shadow-none placeholder:text-[#8a97a8] dark:text-[#eef3f8]";
const BTN = "mt-[18px] flex h-[52px] w-full items-center justify-center rounded-xl bg-[#157a4b] text-[17px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const LABEL = "mb-1.5 mt-3.5 block text-[14px] font-semibold text-[#0d1b2e] dark:text-[#eef3f8]";
const MUTED = "text-[#5d6b7e] dark:text-[#93a3bd]";
const LINK = "font-semibold text-[#157a4b] hover:underline dark:text-[#3fc483]";

export function LoginV6({ initialLang }: { initialLang: V6Lang }) {
  const search = useSearchParams();
  const [lang, setLangState] = useState<V6Lang>(initialLang);
  const tr = (k: string, v?: Record<string, string | number>) => t6(lang, k, v);
  const rtl = lang === "ur";
  const [step, setStep] = useState<Step>("login");
  const [purpose, setPurpose] = useState<Purpose>("reset");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // login
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  // signup
  const [su, setSu] = useState({ name: "", email: "", phone: "", cnic: "", password: "" });
  const [fieldErr, setFieldErr] = useState<FieldErr>({});
  // otp
  const [otpIdent, setOtpIdent] = useState("");
  const [channel, setChannel] = useState<Ch>("sms");
  const [sentTo, setSentTo] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [fails, setFails] = useState(0);
  const [grant, setGrant] = useState("");
  const [redirect, setRedirect] = useState("/portal/dashboard");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  function setLang(l: V6Lang) { setLangState(l); document.cookie = `agribridge_lang=${l}; path=/; max-age=31536000; samesite=lax`; }
  function errText(r: Res) {
    const secs = Number(r.retryAfterSeconds ?? 0);
    return tr(r.error ?? "e_try_again", { m: Math.max(1, Math.ceil(secs / 60)), s: secs, n: codeLengthFor(channel) });
  }
  async function run(fn: () => Promise<Res>, onOk: (r: Res) => void | Promise<void>, onFail?: (r: Res) => boolean) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return setError(tr("e_offline"));
    setBusy(true); setError(null);
    try {
      const r = await fn();
      if (r.ok) await onOk(r);
      else if (!onFail?.(r)) setError(errText(r));
    } catch { setError(tr("e_try_again")); } finally { setBusy(false); }
  }
  const finish = (to: string) => goAfterLogin(routeAfterLogin(search?.get("redirectTo"), to));
  async function afterSignedIn(to: string) {
    setRedirect(to);
    if (await v6NeedsUserId().catch(() => false)) { setStep("userid"); return; }
    finish(to);
  }
  function go(s: Step) { setError(null); setStep(s); }
  function openForgot(prefill: string, p: Purpose = "reset") { setOtpIdent(prefill); setPurpose(p); go("forgot"); }

  const onLogin = () => run(() => v5Login(ident, password) as Promise<Res>, (r) => afterSignedIn(String(r.redirect)), (r) => {
    if (r.error === "e_first_time") { openForgot(ident, "first_time"); return true; }
    return false;
  });
  async function oauth(provider: "google" | "facebook") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } });
  }
  const sendCode = (p: Purpose, who: string, ch: Ch) => run(() => v5SendCode(p, who, ch) as Promise<Res>, (r) => {
    setPurpose(p); setOtpIdent(who); setChannel(ch); setSentTo(String(r.masked)); setSentAt(Date.now()); setFails(0); go("otp");
  });
  const onSignupSubmit = () => run(() => v6CheckSignup({ fullName: su.name, email: su.email, phone: su.phone, cnic: su.cnic, password: su.password }) as Promise<Res>,
    () => { setFieldErr({}); sendCode("signup", su.phone, channel); },
    (r) => { if (r.fields) { setFieldErr(r.fields as FieldErr); return true; } return false; });
  const onVerify = (code: string) => run(async () => {
    const r = await v5VerifyCode(purpose, otpIdent, channel, code) as Res;
    if (!r.ok && r.error === "e_code_wrong") setFails((n) => n + 1);
    if (!r.ok && r.error === "e_code_locked") setFails(OTP_MAX_TRIES);
    return r;
  }, async (r) => {
    setGrant(String(r.grant));
    if (purpose === "signup") {
      await run(() => v5CompleteSignup({ grant: String(r.grant), fullName: su.name, phone: su.phone, email: su.email || undefined, cnic: su.cnic || undefined, password: su.password, confirm: su.password }) as Promise<Res>,
        (x) => afterSignedIn(String(x.redirect)));
    } else go("newpw");
  });
  const onNewPassword = (pw: string, pw2: string) => run(() => v5SetPassword({ grant, password: pw, confirm: pw2 }) as Promise<Res>, (r) => afterSignedIn(String(r.redirect)));

  const n = codeLengthFor(channel);
  const expLeft = Math.max(0, Math.ceil((sentAt + OTP_VALID_MINUTES * 60_000 - now) / 1000));
  const resendLeft = Math.max(0, Math.ceil((sentAt + OTP_RESEND_SECONDS * 1000 - now) / 1000));
  const triesLeft = Math.max(0, OTP_MAX_TRIES - fails);
  const back = step === "signup" || step === "forgot" ? () => go("login") : step === "otp" ? () => go(purpose === "signup" ? "signup" : "forgot") : null;

  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={lang === "ur" ? "ur" : "en"} className={rtl ? "font-urdu leading-[1.9]" : "font-v5"}>
      <div className="rounded-[24px] border border-[#e6efe9] bg-white px-6 py-7 shadow-[0_30px_70px_-30px_rgba(15,61,42,0.33)] dark:border-[#22324f] dark:bg-[#101c33] sm:px-[34px] sm:py-[34px]">
        <div className="mb-1.5 flex items-center justify-between">
          {back ? <button type="button" onClick={back} className={`text-[14px] ${LINK}`}>{rtl ? "→" : "←"} {tr("back")}</button> : <span />}
          <LangToggle lang={lang} onChange={setLang} />
        </div>
        <div className="mb-4 mt-1.5 hidden flex-col items-center gap-2 text-center lg:flex">
          <Logo />
          <div><p className="font-v5 text-[19px] font-bold">AgriBridge</p><p className={`text-[12px] ${MUTED}`}>{tr("brand_sub")}</p></div>
        </div>
        {error && <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

        {step === "login" && <LoginForm tr={tr} busy={busy} ident={ident} setIdent={setIdent} password={password} setPassword={setPassword}
          onSubmit={onLogin} onForgot={() => openForgot(ident)} onSignup={() => go("signup")} onOAuth={oauth} />}

        {step === "signup" && <SignupForm tr={tr} busy={busy} su={su} setSu={setSu} fieldErr={fieldErr} channel={channel} setChannel={setChannel}
          onSubmit={onSignupSubmit} onReset={(v) => openForgot(v)} onLogin={() => go("login")} onOAuth={oauth} />}

        {step === "forgot" && (
          <form onSubmit={(e) => { e.preventDefault(); sendCode(purpose, otpIdent, channel); }}>
            <Steps at={1} />
            <Title t={tr(purpose === "first_time" ? "fp_first_title" : "fp_title")} p={tr("fp_p")} />
            <label htmlFor="fp-id" className={LABEL}>{tr("fp_label")}</label>
            <div className={INPUT_BOX}><input id="fp-id" dir="ltr" autoFocus value={otpIdent} onChange={(e) => setOtpIdent(e.target.value)} placeholder="0300 1234567" className={INPUT} /></div>
            <p className={LABEL}>{tr("how")}</p>
            <Channels value={channel} onChange={setChannel} tr={tr} />
            <button type="submit" disabled={busy || !otpIdent.trim()} className={BTN}>{busy ? tr("wait") : tr("send")}</button>
          </form>
        )}

        {step === "otp" && (
          <OtpStep key={`${sentAt}-${channel}`} n={n} tr={tr} channel={channel} sentTo={sentTo} busy={busy} expLeft={expLeft} resendLeft={resendLeft} triesLeft={triesLeft}
            onVerify={onVerify} onResend={() => sendCode(purpose, otpIdent, channel)} onChange={() => go(purpose === "signup" ? "signup" : "forgot")} />
        )}

        {step === "newpw" && <NewPassword tr={tr} busy={busy} sentTo={sentTo} onSave={onNewPassword} />}

        {step === "userid" && <UserIdStep tr={tr} name={su.name} onDone={() => finish(redirect)} />}
      </div>
      <Footer tr={tr} />
    </div>
  );
}

/** 3520212345671 -> 35202-1234567-1 jaise jaise likha jaye. */
export function formatCnicInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

type OAuthFn = (p: "google" | "facebook") => void;
export type SignupValues = { name: string; email: string; phone: string; cnic: string; password: string };

/** Login form -- alag component (aainda sliding login/signup card mein bhi chalega). */
export function LoginForm({ tr, busy, ident, setIdent, password, setPassword, onSubmit, onForgot, onSignup, onOAuth }:
  { tr: Tr; busy: boolean; ident: string; setIdent: (v: string) => void; password: string; setPassword: (v: string) => void; onSubmit: () => void; onForgot: () => void; onSignup: () => void; onOAuth: OAuthFn }) {
  return (
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <Title t={tr("welcome")} p={tr("welcome_p")} />
            <label htmlFor="v6-id" className={LABEL}>{tr("id_label")}</label>
            <div className={INPUT_BOX}><input id="v6-id" dir="ltr" autoFocus autoComplete="username" value={ident} onChange={(e) => setIdent(e.target.value)} placeholder={tr("id_ph")} className={INPUT} /></div>
            <label htmlFor="v6-pw" className={LABEL}>{tr("pw")}</label>
            <Password id="v6-pw" value={password} onChange={setPassword} tr={tr} autoComplete="current-password" />
            <div className="mt-2.5 text-end text-[14px]"><button type="button" className={LINK} onClick={onForgot}>{tr("forgot")}</button></div>
            <button type="submit" disabled={busy || !ident.trim() || !password} className={BTN}>{busy ? tr("wait") : tr("login")}</button>
            <Social tr={tr} onOAuth={onOAuth} />
            <p className="mt-4 text-center text-[14px] text-[#3d4a5c] dark:text-[#c2cde0]">{tr("no_acc")} <button type="button" className={LINK} onClick={onSignup}>{tr("signup")}</button></p>
          </form>
  );
}

/** Signup form -- alag component (sliding card ke liye tayyar). */
export function SignupForm({ tr, busy, su, setSu, fieldErr, channel, setChannel, onSubmit, onReset, onLogin, onOAuth }:
  { tr: Tr; busy: boolean; su: SignupValues; setSu: (v: SignupValues) => void; fieldErr: FieldErr; channel: Ch; setChannel: (c: Ch) => void; onSubmit: () => void; onReset: (prefill: string) => void; onLogin: () => void; onOAuth: OAuthFn }) {
  return (
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
            <Title t={tr("su_title")} p={tr("su_p")} />
            <Field id="su-name" label={tr("name")} err={fieldErr.name && tr(fieldErr.name)}><input id="su-name" autoComplete="name" value={su.name} onChange={(e) => setSu({ ...su, name: e.target.value })} placeholder={tr("name_ph")} className={INPUT} /></Field>
            <Field id="su-email" label={tr("email")} err={fieldErr.email && tr(fieldErr.email)} dupLink={fieldErr.email === "e_email_taken" ? <ResetLink tr={tr} onClick={() => onReset(su.email)} /> : null}>
              <input id="su-email" dir="ltr" type="email" autoComplete="email" value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} placeholder={tr("email_ph")} className={INPUT} /></Field>
            <Field id="su-phone" label={tr("mobile")} err={fieldErr.phone && tr(fieldErr.phone)} dupLink={fieldErr.phone === "e_phone_taken" ? <ResetLink tr={tr} onClick={() => onReset(su.phone)} /> : null}>
              <input id="su-phone" dir="ltr" inputMode="tel" autoComplete="tel" value={su.phone} onChange={(e) => setSu({ ...su, phone: e.target.value })} placeholder="0300 1234567" className={INPUT} /></Field>
            <Field id="su-cnic" label={tr("cnic")} help={tr("cnic_help")} err={fieldErr.cnic && tr(fieldErr.cnic)} dupLink={fieldErr.cnic === "e_cnic_taken" ? <ResetLink tr={tr} onClick={() => onReset(su.cnic)} /> : null}>
              <input id="su-cnic" dir="ltr" inputMode="numeric" value={su.cnic} onChange={(e) => setSu({ ...su, cnic: formatCnicInput(e.target.value) })} placeholder="12345-1234567-1" className={INPUT} /></Field>
            <label htmlFor="su-pw" className={LABEL}>{tr("pw")}</label>
            <Password id="su-pw" value={su.password} onChange={(v) => setSu({ ...su, password: v })} tr={tr} autoComplete="new-password" err={Boolean(fieldErr.password)} />
            {fieldErr.password ? <p className="mt-1.5 text-[13px] font-medium text-[#c62828]">{tr(fieldErr.password)}</p> : <p className={`mt-1.5 text-[12.5px] ${MUTED}`}>{tr("pw_rule")}</p>}
            <p className={LABEL}>{tr("how")}</p>
            <Channels value={channel} onChange={setChannel} tr={tr} />
            <button type="submit" disabled={busy} className={BTN}>{busy ? tr("wait") : tr("create")}</button>
            <p className={`mt-2.5 text-center text-[12.5px] ${MUTED}`}>{tr("unique_note")}</p>
            <Social tr={tr} onOAuth={onOAuth} />
            <p className="mt-4 text-center text-[14px] text-[#3d4a5c] dark:text-[#c2cde0]">{tr("have_acc")} <button type="button" className={LINK} onClick={onLogin}>{tr("login")}</button></p>
          </form>
  );
}

type Tr = (k: string, v?: Record<string, string | number>) => string;

function Title({ t, p }: { t: string; p?: string }) {
  return <><h1 className="mb-1.5 text-center text-[26px] font-bold text-[#0d1b2e] dark:text-white">{t}</h1>{p && <p className={`mb-4 text-center text-[14.5px] leading-6 ${MUTED}`}>{p}</p>}</>;
}
function Field({ id, label, help, err, dupLink, children }: { id: string; label: string; help?: string; err?: string | false; dupLink?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className={`${INPUT_BOX} ${err ? "!border-[#c62828] shadow-[0_0_0_4px_rgba(198,40,40,0.11)]" : ""}`}>{children}</div>
      {err ? <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#c62828]">⚠ {err} {dupLink}</p> : help ? <p className={`mt-1.5 text-[12.5px] ${MUTED}`}>{help}</p> : null}
    </div>
  );
}
function ResetLink({ tr, onClick }: { tr: Tr; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="font-semibold text-[#c62828] underline">{tr("reset_instead")}</button>;
}
function Password({ id, value, onChange, tr, autoComplete, err }: { id: string; value: string; onChange: (v: string) => void; tr: Tr; autoComplete: string; err?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`${INPUT_BOX} ${err ? "!border-[#c62828]" : ""}`}>
      <input id={id} dir="ltr" type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      <button type="button" onClick={() => setShow(!show)} aria-label={tr(show ? "hide" : "show")} title={tr(show ? "hide" : "show")} className="ms-2 flex text-[#6b7a8c]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{show ? <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /> : <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>}</svg>
      </button>
    </div>
  );
}
function Channels({ value, onChange, tr }: { value: Ch; onChange: (c: Ch) => void; tr: Tr }) {
  const opts: [Ch, string, string][] = [["sms", "ch_sms", "ch_sms_p"], ["whatsapp", "ch_wa", "ch_wa_p"]];
  return (
    <div role="radiogroup" className="flex flex-col gap-2.5">
      {opts.map(([c, a, b]) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} onClick={() => onChange(c)}
          className={`flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-3 text-start ${value === c ? "border-[#157a4b] bg-[#f1f9f4] dark:bg-[#0f2a1f]" : "border-[#d3dbe2] dark:border-[#22324f]"}`}>
          <span className={`h-[18px] w-[18px] flex-none rounded-full ${value === c ? "border-[5px] border-[#157a4b]" : "border-2 border-[#b8c4cf]"}`} />
          <span><b className="block text-[15px]">{tr(a)}</b><span className={`text-[12.5px] ${MUTED}`}>{tr(b)}</span></span>
        </button>
      ))}
    </div>
  );
}
function Steps({ at }: { at: number }) {
  return <div className="mb-4 flex gap-1.5">{[1, 2, 3].map((i) => <i key={i} className={`h-1 flex-1 rounded ${i <= at ? "bg-[#157a4b]" : "bg-[#e3e8ee] dark:bg-[#22324f]"}`} />)}</div>;
}
function Social({ tr, onOAuth }: { tr: Tr; onOAuth: (p: "google" | "facebook") => void }) {
  const btn = "flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[#dfe5ea] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.07)] transition hover:shadow-md dark:border-[#22324f]";
  return (
    <>
      <div className="mb-3 mt-6 flex items-center gap-2.5 text-[13px] text-[#8a97a8] before:h-px before:flex-1 before:bg-[#e3e8ee] after:h-px after:flex-1 after:bg-[#e3e8ee]">{tr("social")}</div>
      <div className="flex justify-center gap-4">
        <button type="button" onClick={() => onOAuth("google")} aria-label={tr("google")} title={tr("google")} className={btn}><GoogleMark /></button>
        <button type="button" onClick={() => onOAuth("facebook")} aria-label={tr("facebook")} title={tr("facebook")} className={btn}><FacebookMark /></button>
      </div>
    </>
  );
}
function OtpStep({ n, tr, channel, sentTo, busy, expLeft, resendLeft, triesLeft, onVerify, onResend, onChange }:
  { n: number; tr: Tr; channel: Ch; sentTo: string; busy: boolean; expLeft: number; resendLeft: number; triesLeft: number; onVerify: (c: string) => void; onResend: () => void; onChange: () => void }) {
  const [digits, setDigits] = useState<string[]>(() => Array(n).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");
  const locked = triesLeft <= 0 || expLeft <= 0;
  function put(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    if (v.length > 1) { const next = v.slice(0, n).split(""); while (next.length < n) next.push(""); setDigits(next); refs.current[Math.min(n - 1, v.length)]?.focus(); return; }
    const next = digits.slice(); next[i] = v; setDigits(next);
    if (v && i < n - 1) refs.current[i + 1]?.focus();
  }
  const mmss = `${String(Math.floor(expLeft / 60)).padStart(2, "0")}:${String(expLeft % 60).padStart(2, "0")}`;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.length === n) onVerify(code); }}>
      <Steps at={2} />
      <Title t={tr("otp_title")} />
      <p className={`mb-4 text-center text-[14.5px] ${MUTED}`}>{tr(channel === "sms" ? "otp_p_sms" : "otp_p_wa", { n })}<br /><b dir="ltr" className="text-[#0d1b2e] dark:text-white">{sentTo}</b></p>
      <div dir="ltr" className="flex justify-center gap-2.5">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={tr("otp_digit", { n: i + 1 })}
            onChange={(e) => put(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }} disabled={locked}
            className={`h-[60px] ${n === 6 ? "w-[44px] sm:w-[48px]" : "w-[56px]"} rounded-xl border-[1.5px] text-center text-[24px] font-bold !outline-none focus:border-[#157a4b] focus:shadow-[0_0_0_4px_rgba(21,122,75,0.12)] dark:bg-[#0c1629] ${d ? "border-[#157a4b]" : "border-[#d3dbe2] dark:border-[#22324f]"}`} />
        ))}
      </div>
      <div className={`mt-3.5 flex justify-between text-[13px] ${MUTED}`}>
        <span>⏱ {expLeft > 0 ? <>{tr("expires")}: <b dir="ltr" className="text-[#0d1b2e] dark:text-white">{mmss}</b></> : tr("expired")}</span>
        <span>{tr("tries")}: <b className="text-[#0d1b2e] dark:text-white">{triesLeft}</b></span>
      </div>
      <button type="submit" disabled={busy || code.length !== n || locked} className={BTN}>{busy ? tr("wait") : tr("verify")}</button>
      <div className={`mt-3.5 flex justify-between text-[13px] ${MUTED}`}>
        <span>{tr("no_code")}</span>
        <button type="button" disabled={resendLeft > 0 || busy} onClick={onResend} className={`${LINK} disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline`}>{tr("resend")}{resendLeft > 0 ? ` (0:${String(resendLeft).padStart(2, "0")})` : ""}</button>
      </div>
      <div className="mt-2.5 text-center text-[14px]"><button type="button" onClick={onChange} className={LINK}>{tr("change_number")}</button></div>
    </form>
  );
}
function NewPassword({ tr, busy, sentTo, onSave }: { tr: Tr; busy: boolean; sentTo: string; onSave: (a: string, b: string) => void }) {
  const [a, setA] = useState(""); const [b, setB] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(a, b); }}>
      <Steps at={3} />
      <div className="mb-3.5 rounded-xl bg-[#eef6f1] px-3.5 py-2.5 text-center text-[13.5px] text-[#0f3d2a] dark:bg-[#0f2a1f] dark:text-[#bfe8d0]">✓ {tr("verified")}: <bdi dir="ltr">{sentTo}</bdi></div>
      <Title t={tr("np_title")} />
      <label htmlFor="np1" className={LABEL}>{tr("np")}</label>
      <Password id="np1" value={a} onChange={setA} tr={tr} autoComplete="new-password" />
      <p className={`mt-1.5 text-[12.5px] ${MUTED}`}>{tr("pw_rule")}</p>
      <label htmlFor="np2" className={LABEL}>{tr("np2")}</label>
      <Password id="np2" value={b} onChange={setB} tr={tr} autoComplete="new-password" />
      {b && a === b && <p className="mt-1.5 text-[13px] font-semibold text-[#157a4b]">✓ {tr("match")}</p>}
      <button type="submit" disabled={busy || !a || !b} className={BTN}>{busy ? tr("wait") : tr("save_pw")}</button>
    </form>
  );
}
function UserIdStep({ tr, name, onDone }: { tr: Tr; name: string; onDone: () => void }) {
  const [v, setV] = useState("");
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!v.trim()) { setState(null); return; }
    const id = setTimeout(async () => {
      setState({ ok: false, msg: tr("uid_checking") });
      const r = await v6UserIdCheck(v).catch(() => ({ ok: false, error: "e_try_again" })) as Res;
      setState(r.ok ? { ok: true, msg: tr("uid_ok", { u: String(r.name) }) } : { ok: false, msg: tr(r.error ?? "e_try_again") });
    }, 400);
    return () => clearTimeout(id);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    setBusy(true);
    const r = await v6SaveUserId(v).catch(() => ({ ok: false, error: "e_try_again" })) as Res;
    setBusy(false);
    if (r.ok) onDone(); else setState({ ok: false, msg: tr(r.error ?? "e_try_again") });
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="mb-3.5 rounded-xl bg-[#eef6f1] px-3.5 py-2.5 text-center text-[13.5px] text-[#0f3d2a] dark:bg-[#0f2a1f] dark:text-[#bfe8d0]">👋 {tr("uid_hi")}{name ? `, ${name}` : ""}</div>
      <Title t={tr("uid_title")} p={tr("uid_p")} />
      <label htmlFor="uid" className={LABEL}>{tr("uid")}</label>
      <div className={INPUT_BOX}><input id="uid" dir="ltr" autoFocus value={v} onChange={(e) => setV(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="aslam.farms" className={INPUT} />{state?.ok && <span className="text-[#157a4b]">✓</span>}</div>
      {state && <p className={`mt-1.5 text-[13px] font-semibold ${state.ok ? "text-[#157a4b]" : "text-[#c62828]"}`}>{state.ok ? "✓ " : ""}{state.msg}</p>}
      <p className={`mt-1.5 text-[12.5px] ${MUTED}`}>{tr("uid_rule")}</p>
      <button type="submit" disabled={busy || !state?.ok} className={BTN}>{busy ? tr("wait") : tr("uid_save")}</button>
      <div className="mt-3 text-center text-[14px]"><button type="button" onClick={onDone} className={LINK}>{tr("skip")}</button></div>
    </form>
  );
}
function LangToggle({ lang, onChange }: { lang: V6Lang; onChange: (l: V6Lang) => void }) {
  const opts: [V6Lang, string][] = [["en", "EN"], ["rm", "Roman"], ["ur", "اردو"]];
  return (
    <div role="radiogroup" aria-label="Language" dir="ltr" className="inline-flex rounded-[10px] bg-[#f1f5f2] p-[3px] text-[12px] font-semibold dark:bg-[#13284a]">
      {opts.map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => onChange(k)}
          className={`rounded-lg px-2.5 py-1 ${k === "ur" ? "font-urdu" : "font-v5"} ${lang === k ? "bg-white text-[#0d1b2e] shadow-sm dark:bg-[#101c33] dark:text-white" : "text-[#5d6b7e]"}`}>{label}</button>
      ))}
    </div>
  );
}
function Footer({ tr }: { tr: Tr }) {
  return (
    <div className={`mt-[18px] flex flex-col items-center gap-2 px-1.5 text-[13px] sm:flex-row sm:justify-between ${MUTED}`}>
      <a href="https://wa.me/923226275476" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#25D366" /><path fill="#fff" d="M17 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-1.6-.8-2.6-1.5-3.6-3.2-.3-.5.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1 2.1-.3 3.4.9 1.6 2.3 3.6 5.2 4.6 1.6.5 2.4.4 3 .1.5-.3 1.1-1 1.2-1.5.1-.5.1-.8-.4-1z" /></svg>
        {tr("help")} <bdi dir="ltr" className="font-semibold text-[#0d1b2e] dark:text-white">0322 6275476</bdi>
      </a>
      <span className="flex gap-4"><a href="/terms-and-conditions" className="hover:underline">{tr("terms")}</a><a href="/privacy-policy" className="hover:underline">{tr("privacy")}</a></span>
    </div>
  );
}
function Logo() {
  return (
    <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id="v6lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f7a4d" /><stop offset="1" stopColor="#0f3d2a" /></linearGradient></defs>
      <rect width="48" height="48" rx="13" fill="url(#v6lg)" />
      <path d="M24 36V17" stroke="#f3d27a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 24c-6 0-9-3.5-9.5-8.5 6 .3 9.2 3.6 9.5 8.5zM24 30c6 0 9-3.5 9.5-8.5-6 .3-9.2 3.6-9.5 8.5z" fill="#f3d27a" />
      <path d="M15 36h18" stroke="#9fd6b0" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
export function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
export function FacebookMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M16.7 15.5l.5-3.5h-3.3V9.8c0-1 .5-1.9 2-1.9h1.5V5s-1.4-.2-2.7-.2c-2.8 0-4.6 1.7-4.6 4.7V12H7v3.5h3.1V24h3.8v-8.5z" />
    </svg>
  );
}
