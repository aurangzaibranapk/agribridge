"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v5CompleteSignup, v5Login, v5Lookup, v5SendCode, v5SetPassword, v5VerifyCode } from "@/actions/login-v5";
import { OtpGlassy } from "@/app/login/otp-glassy";
import { goAfterLogin, routeAfterLogin } from "@/lib/navigation/after-login";
import { tx, type V5Lang } from "@/app/login/v5-text";
import { applyOtpBackspace, applyOtpInput, emptyOtpDigits, resendLeftSeconds } from "@/lib/auth/otp-ui";

type Channel = "whatsapp" | "sms" | "email";
type Purpose = "signup" | "first_time" | "reset";
type Step = "id" | "password" | "pick" | "otp" | "details" | "newpw";
type Res = { ok: boolean; error?: string; retryAfterSeconds?: number; [k: string]: unknown };

const GREEN = "bg-gradient-to-b from-[#1a8a55] to-[#0f5c39] dark:from-[#22a565] dark:to-[#137a4a]";
const FIELD = "flex h-14 items-center gap-3 rounded-[14px] border-[1.5px] border-[#e3e8ee] bg-[#fbfcfd] px-4 transition focus-within:border-[#157a4b] focus-within:shadow-[0_0_0_4px_rgba(21,122,75,0.12)] dark:border-[#22324f] dark:bg-[#0c1629] dark:focus-within:border-[#22a565]";
const INPUT = "h-full min-w-0 flex-1 border-0 bg-transparent !outline-none !ring-0 !shadow-none text-[16px] font-semibold text-[#0d1b2e] outline-none placeholder:font-normal placeholder:text-[#8a96a8] dark:text-[#eef3f8]";
const CTA = `${GREEN} mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,92,57,0.7)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60`;
const LINK = "font-semibold text-[#157a4b] hover:underline dark:text-[#3fc483]";
const LABEL = "mb-2 block text-[13.5px] font-semibold text-[#0d1b2e] dark:text-[#eef3f8]";
const MUTED = "text-[#5d6b7e] dark:text-[#93a3bd]";

const OTP_PREVIEWS = ["empty", "typing", "error", "verified"] as const;
type OtpPreview = (typeof OTP_PREVIEWS)[number];

export function LoginV5({ initialLang, preview = null }: { initialLang: V5Lang; preview?: string | null }) {
  const search = useSearchParams();
  const otpPreview: OtpPreview | null = preview && (OTP_PREVIEWS as readonly string[]).includes(preview) ? preview as OtpPreview : null;
  const [lang, setLangState] = useState<V5Lang>(initialLang);
  const tr = (k: string, v?: Record<string, string | number>) => tx(lang, k, v);
  const rtl = lang === "ur";
  const [step, setStep] = useState<Step>(otpPreview ? "otp" : "id");
  const [purpose, setPurpose] = useState<Purpose>("signup");
  const [identifier, setIdentifier] = useState("");
  const [kind, setKind] = useState<"phone" | "email" | "username">("phone");
  const [masked, setMasked] = useState("");
  const [channels, setChannels] = useState<Channel[]>(otpPreview ? ["whatsapp", "sms", "email"] : []);
  const [channel, setChannel] = useState<Channel>(otpPreview ? "sms" : "whatsapp");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState(otpPreview ? "0322-*****76" : "");
  const [grant, setGrant] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(otpPreview === "error" ? "e_code_wrong" : null);
  const [otpFails, setOtpFails] = useState(otpPreview === "error" ? 1 : 0);
  const [otpVerified, setOtpVerified] = useState(otpPreview === "verified");
  const [resendAt, setResendAt] = useState(() => otpPreview ? Date.now() + (otpPreview === "error" ? 18_000 : 42_000) : 0);

  function setLang(l: V5Lang) {
    setLangState(l);
    document.cookie = `agribridge_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  }
  function showError(r: Res) {
    const key = r.error ?? "e_try_again";
    const secs = Number(r.retryAfterSeconds ?? 0);
    setErrorKey(key);
    setError(tr(key, { m: Math.max(1, Math.ceil(secs / 60)), s: secs }));
  }
  function clearError() { setError(null); setErrorKey(null); }
  async function run(fn: () => Promise<Res>, onOk: (r: Res) => void) {
    if (typeof navigator !== "undefined" && !navigator.onLine) return setError(tr("e_offline"));
    setBusy(true); clearError();
    try {
      const r = await fn();
      if (r.ok) onOk(r); else {
        showError(r);
        if (r.state === "first_time") { setPurpose("first_time"); setStep("pick"); }
      }
    } catch { setError(tr("e_try_again")); } finally { setBusy(false); }
  }
  function done(redirect: string) { goAfterLogin(routeAfterLogin(search?.get("redirectTo"), redirect)); }

  const onContinue = () => run(() => v5Lookup(identifier) as Promise<Res>, (r) => {
    setKind(r.kind as typeof kind); setMasked(String(r.masked));
    const list = (r.channels as Channel[]) ?? []; setChannels(list);
    setChannel((r.defaultChannel as Channel) ?? "whatsapp");
    if (r.state === "password") setStep("password");
    else { setPurpose(r.state === "new" ? "signup" : "first_time"); setStep("pick"); }
  });
  const onLogin = (pw: string) => run(() => v5Login(identifier, pw) as Promise<Res>, (r) => done(String(r.redirect)));
  const onSend = () => {
    if (otpPreview) { setSentTo("0322-*****76"); setResendAt(Date.now() + 60_000); setOtpFails(0); setOtpVerified(false); clearError(); setStep("otp"); return; }
    run(() => v5SendCode(purpose, identifier, channel, email || undefined) as Promise<Res>, (r) => {
      setSentTo(String(r.masked)); setResendAt(Date.now() + 60_000); setOtpFails(0); setOtpVerified(false); setStep("otp");
    });
  };
  const onVerify = (code: string) => {
    if (otpPreview) {
      clearError();
      if (code === "000000" || code === "482915") { setOtpFails((n) => n + 1); setErrorKey("e_code_wrong"); setError(tr("otp_wrong")); setOtpVerified(false); }
      else setOtpVerified(true);
      return;
    }
    run(async () => {
      const r = await v5VerifyCode(purpose, identifier, channel, code, email || undefined) as Res;
      if (!r.ok && r.error === "e_code_wrong") setOtpFails((n) => n + 1);
      if (!r.ok && r.error === "e_code_locked") setOtpFails(3);
      return r;
    }, (r) => {
      setGrant(String(r.grant)); setVerifiedPhone(Boolean(r.verifiedPhone)); setVerifiedEmail((r.verifiedEmail as string) ?? null);
      setOtpVerified(true);
    });
  };
  function switchChannel() { clearError(); setOtpVerified(false); setStep("pick"); }
  function afterOtp() { setOtpVerified(false); setStep(purpose === "signup" ? "details" : "newpw"); }
  const restart = () => { setStep("id"); clearError(); setPassword(""); setGrant(""); setEmail(""); setOtpVerified(false); setOtpFails(0); };

  return (
    <div dir={rtl ? "rtl" : "ltr"} lang={lang === "ur" ? "ur" : "en"} className={rtl ? "font-urdu leading-[1.9]" : "font-v5"}>
      <div className={step === "otp" ? "rounded-[24px] border border-white/80 bg-white/55 px-5 py-6 shadow-[0_24px_60px_rgba(15,31,58,0.14),inset_0_1px_0_#fff] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#101c33]/75 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:px-8 sm:py-8" : "rounded-[24px] border border-[#e3e8ee] bg-white px-6 py-7 shadow-[0_1px_2px_rgba(13,27,46,0.04),0_30px_60px_-30px_rgba(13,27,46,0.18)] dark:border-[#22324f] dark:bg-[#101c33] dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] sm:px-10 sm:py-9"}>
        {step !== "otp" && <div className="mb-6 flex justify-end"><LangToggle lang={lang} onChange={setLang} /></div>}
        {error && step === "otp" && !["e_code_wrong", "e_code_locked", "e_code_expired"].includes(errorKey ?? "") ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        {error && step !== "otp" && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] leading-5 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

        {step === "id" && (
          <form onSubmit={(e) => { e.preventDefault(); onContinue(); }}>
            <H1>{tr("welcome")}</H1>
            <p className={`mb-7 mt-2 text-[15px] leading-6 ${MUTED}`}>{tr("welcome_p")}</p>
            <label htmlFor="v5-id" className={LABEL}>{tr("id_label")}</label>
            <div className={FIELD}>
              <IdPrefix value={identifier} />
              <input id="v5-id" dir="ltr" autoFocus autoComplete="username" inputMode="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={tr("id_ph")} className={INPUT} />
            </div>
            <button type="submit" disabled={busy || !identifier.trim()} className={CTA}>{busy ? tr("wait") : tr("cont")} <Arrow rtl={rtl} /></button>
            <p className={`mt-4 flex items-center gap-2 text-[13px] ${MUTED}`}><Icon n="lock" s={14} />{tr("first_hint")}</p>
          </form>
        )}

        {step === "password" && (
          <PasswordStep tr={tr} rtl={rtl} masked={masked} kind={kind} busy={busy} onChange={restart}
            onSubmit={(pw) => onLogin(pw)}
            onForgot={() => { setPurpose("reset"); setError(null); setStep("pick"); }} />
        )}

        {step === "pick" && (
          <form onSubmit={(e) => { e.preventDefault(); onSend(); }}>
            <WhoPill masked={masked} kind={kind} onChange={restart} tr={tr} />
            <Badge n={purpose === "reset" ? "key" : purpose === "first_time" ? "shield" : "user"} />
            <H1>{tr(purpose === "reset" ? "forgot_title" : purpose === "first_time" ? "first_title" : "new_title")}</H1>
            <p className={`mb-6 mt-2 text-[15px] leading-6 ${MUTED}`}>{tr(purpose === "reset" ? "forgot_p" : purpose === "first_time" ? "first_p" : kind === "email" ? "new_p_email" : "new_p")}</p>
            <ChannelPicker tr={tr} value={channel} allowed={channels} onChange={setChannel} />
            {!channels.includes("email") && purpose !== "signup" && <p className={`mt-2 text-[12.5px] ${MUTED}`}>{tr("no_email_note")}</p>}
            {purpose === "signup" && kind === "phone" && channel === "email" && (
              <div className="mt-4"><label htmlFor="v5-email" className={LABEL}>{tr("email_label")}</label>
                <div className={FIELD}><Icon n="mail" s={18} /><input id="v5-email" dir="ltr" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={INPUT} /></div></div>
            )}
            <button type="submit" disabled={busy || !channels.includes(channel)} className={CTA}>{busy ? tr("wait") : tr("send_code")} <Arrow rtl={rtl} /></button>
            {purpose === "reset" && <button type="button" onClick={() => { setError(null); setStep("password"); }} className={`mt-4 w-full text-center text-[14px] ${LINK}`}>{tr("back")}</button>}
          </form>
        )}

        {step === "otp" && (
          <OtpStep lang={lang} langToggle={<LangToggle lang={lang} onChange={setLang} />} sentTo={sentTo}
            channel={channel} channels={channels.length ? channels : [channel]}
            busy={busy} resendAt={resendAt} fails={otpFails} errorKey={otpVerified ? null : errorKey} verified={otpVerified}
            preview={otpPreview} onBack={switchChannel} onSwitchChannel={switchChannel} onVerify={onVerify} onResend={onSend}
            onContinue={afterOtp} onClearError={clearError} />
        )}

        {step === "details" && (
          <DetailsStep tr={tr} busy={busy} identifier={identifier} kind={kind} verifiedPhone={verifiedPhone} verifiedEmail={verifiedEmail} sentTo={sentTo}
            onSubmit={(d) => run(() => v5CompleteSignup({ grant, ...d }) as Promise<Res>, (r) => done(String(r.redirect)))} />
        )}

        {step === "newpw" && (
          <NewPasswordStep tr={tr} busy={busy} sentTo={sentTo} password={password} setPassword={setPassword}
            onSubmit={(pw, confirm) => run(() => v5SetPassword({ grant, password: pw, confirm }) as Promise<Res>, (r) => done(String(r.redirect)))} />
        )}
      </div>
      <Footer tr={tr} />
    </div>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="font-v5display text-[27px] font-semibold tracking-[-0.02em] text-[#0d1b2e] dark:text-[#eef3f8] [[dir=rtl]_&]:font-urdu [[dir=rtl]_&]:font-bold">{children}</h1>;
}

function LangToggle({ lang, onChange }: { lang: V5Lang; onChange: (l: V5Lang) => void }) {
  const opts: [V5Lang, string][] = [["en", "EN"], ["rm", "Roman"], ["ur", "اردو"]];
  return (
    <div role="radiogroup" aria-label="Language" dir="ltr" className="inline-flex rounded-[10px] bg-[#eef6f1] p-[3px] text-[12.5px] font-semibold dark:bg-[#13284a]">
      {opts.map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => onChange(k)}
          className={`rounded-lg px-3 py-1.5 transition ${k === "ur" ? "font-urdu text-[12px] leading-[1.3]" : "font-v5"} ${lang === k ? "bg-white text-[#0d1b2e] shadow-sm dark:bg-[#101c33] dark:text-white" : "text-[#5d6b7e] hover:text-[#0d1b2e] dark:text-[#93a3bd]"}`}>{label}</button>
      ))}
    </div>
  );
}

function IdPrefix({ value }: { value: string }) {
  const looksPhone = /^[+\d]/.test(value.trim()) || value.trim() === "";
  return (
    <span dir="ltr" className="flex items-center gap-2 border-e border-[#e3e8ee] pe-3 font-v5 font-semibold text-[#5d6b7e] dark:border-[#22324f] dark:text-[#93a3bd]">
      {looksPhone ? (<><PkFlag /><bdi>+92</bdi></>) : value.includes("@") ? <Icon n="mail" s={18} /> : <Icon n="user" s={18} />}
    </span>
  );
}

function WhoPill({ masked, kind, onChange, tr }: { masked: string; kind: string; onChange: () => void; tr: (k: string) => string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-[#e3e8ee] bg-[#eef6f1] px-3.5 py-2.5 dark:border-[#22324f] dark:bg-[#13284a]">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-[#157a4b] dark:bg-[#101c33] dark:text-[#3fc483]"><Icon n={kind === "email" ? "mail" : kind === "username" ? "user" : "phone"} s={16} /></span>
      <bdi dir="ltr" className="font-v5 font-semibold text-[#0d1b2e] dark:text-[#eef3f8]">{masked}</bdi>
      <button type="button" onClick={onChange} className={`ms-auto text-[14px] ${LINK}`}>{tr("change")}</button>
    </div>
  );
}

function PasswordStep({ tr, rtl, masked, kind, busy, onChange, onSubmit, onForgot }: {
  tr: (k: string) => string; rtl: boolean; masked: string; kind: string; busy: boolean; onChange: () => void; onSubmit: (pw: string) => void; onForgot: () => void;
}) {
  const [pw, setPw] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }}>
      <WhoPill masked={masked} kind={kind} onChange={onChange} tr={tr} />
      <H1>{tr("pw_title")}</H1>
      <p className={`mb-6 mt-2 text-[15px] ${MUTED}`}>{tr("pw_p")}</p>
      <PwField id="v5-pw" label={tr("pw")} value={pw} onChange={setPw} autoComplete="current-password" autoFocus showLabel={tr("show")} />
      <div className="mt-3.5 flex justify-end text-[13.5px]"><button type="button" onClick={onForgot} className={LINK}>{tr("forgot")}</button></div>
      <button type="submit" disabled={busy || !pw} className={CTA}>{busy ? tr("wait") : tr("login")} <Arrow rtl={rtl} /></button>
    </form>
  );
}

function PwField({ id, label, value, onChange, autoComplete, autoFocus, showLabel, below }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean; showLabel: string; below?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className={FIELD}>
        <span className="text-[#5d6b7e] dark:text-[#93a3bd]"><Icon n="lock" s={18} /></span>
        <input id={id} dir="ltr" type={show ? "text" : "password"} autoComplete={autoComplete} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} ${show ? "" : "tracking-[0.18em]"}`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={showLabel} aria-pressed={show} className="text-[#5d6b7e] hover:text-[#0d1b2e] dark:text-[#93a3bd] dark:hover:text-white"><Icon n={show ? "eyeoff" : "eye"} s={18} /></button>
      </div>
      {below}
    </div>
  );
}

function ChannelPicker({ tr, value, allowed, onChange }: { tr: (k: string) => string; value: Channel; allowed: Channel[]; onChange: (c: Channel) => void }) {
  const all: [Channel, string][] = [["whatsapp", "ch_whatsapp"], ["sms", "ch_sms"], ["email", "ch_email"]];
  return (
    <fieldset>
      <legend className={LABEL}>{tr("send_via")}</legend>
      <div role="radiogroup" className="grid grid-cols-3 gap-2">
        {all.map(([c, k]) => {
          const ok = allowed.includes(c); const on = value === c && ok;
          return (
            <button key={c} type="button" role="radio" aria-checked={on} disabled={!ok} onClick={() => onChange(c)}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-[#157a4b] bg-[#eef6f1] text-[#0f5c39] dark:border-[#22a565] dark:bg-[#13284a] dark:text-[#3fc483]" : "border-[#e3e8ee] bg-white text-[#3c4a5c] hover:border-[#b9c6d4] dark:border-[#22324f] dark:bg-[#0c1629] dark:text-[#c3cee0]"}`}>
              {c === "whatsapp" ? <WaMark /> : <Icon n={c === "sms" ? "chat" : "mail"} s={17} />}{tr(k)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function seedDigits(preview: OtpPreview | null): string[] {
  if (preview === "typing") return ["4", "8", "2", "", "", ""];
  if (preview === "error") return ["4", "8", "2", "9", "1", "5"];
  return emptyOtpDigits();
}

function OtpStep({ lang, langToggle, sentTo, channel, channels, busy, resendAt, fails, errorKey, verified, preview, onBack, onSwitchChannel, onVerify, onResend, onContinue, onClearError }: {
  lang: V5Lang; langToggle: React.ReactNode; sentTo: string; channel: Channel; channels: Channel[]; busy: boolean; resendAt: number;
  fails: number; errorKey: string | null; verified: boolean; preview: OtpPreview | null;
  onBack: () => void; onSwitchChannel: () => void; onVerify: (c: string) => void; onResend: () => void; onContinue: () => void; onClearError: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => seedDigits(preview));
  const [focus, setFocus] = useState(preview === "typing" ? 3 : preview === "error" ? 5 : 0);
  const [shake, setShake] = useState(preview === "error" ? 1 : 0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!verified) refs.current[focus]?.focus(); }, [focus, verified, shake]);
  useEffect(() => { if (errorKey === "e_code_wrong") setShake((s) => s + 1); }, [fails, errorKey]);
  function commit(next: ReturnType<typeof applyOtpInput>) {
    const changed = next.digits.join("") !== digits.join("");
    setDigits(next.digits); setFocus(next.focus);
    if (changed && errorKey) onClearError();
    if (next.submit && !busy) onVerify(next.submit);
  }
  return (
    <OtpGlassy lang={lang} langToggle={langToggle} sentTo={sentTo} channel={channel} channels={channels} digits={digits} focus={focus}
      busy={busy} resendLeft={resendLeftSeconds(resendAt, now)} fails={fails} errorKey={errorKey} verified={verified} shake={shake}
      inputRef={(i, el) => { refs.current[i] = el; }}
      onDigit={(i, raw) => commit(applyOtpInput(digits, i, raw))}
      onBackspace={(i) => { const next = applyOtpBackspace(digits, i); setDigits(next.digits); setFocus(next.focus); if (errorKey) onClearError(); }}
      onFocus={setFocus} onVerify={() => onVerify(digits.join(""))} onResend={onResend} onSwitchChannel={onSwitchChannel} onBack={onBack} onContinue={onContinue} />
  );
}

function Strength({ pw, tr }: { pw: string; tr: (k: string) => string }) {
  const s = useMemo(() => { let n = 0; if (pw.length >= 8) n++; if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) n++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) n++; if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 12) n++; return n; }, [pw]);
  if (!pw) return <p className={`mt-2 text-[12.5px] ${MUTED}`}>{tr("pw_rule")}</p>;
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {[0, 1, 2, 3].map((i) => <i key={i} className={`h-1 flex-1 rounded ${i < s ? (s >= 3 ? "bg-[#157a4b] dark:bg-[#22a565]" : "bg-amber-500") : "bg-[#e3e8ee] dark:bg-[#22324f]"}`} />)}
      <span className={`ms-1.5 text-[12px] font-semibold ${s >= 3 ? "text-[#157a4b] dark:text-[#3fc483]" : "text-amber-600"}`}>{tr(s >= 3 ? "strong" : "weak")}</span>
    </div>
  );
}

function Match({ a, b, tr }: { a: string; b: string; tr: (k: string) => string }) {
  if (!b || a !== b) return null;
  return <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[#157a4b] dark:text-[#3fc483]"><Icon n="check" s={13} />{tr("pw_match")}</p>;
}

function VerifiedPill({ tr, sentTo }: { tr: (k: string) => string; sentTo: string }) {
  return <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#eef6f1] px-3 py-1.5 text-[12.5px] font-semibold text-[#157a4b] dark:bg-[#13284a] dark:text-[#3fc483]"><Icon n="check" s={14} />{tr("verified")} · <bdi dir="ltr" className="font-v5">{sentTo}</bdi></div>;
}

function DetailsStep({ tr, busy, identifier, kind, verifiedPhone, verifiedEmail, sentTo, onSubmit }: {
  tr: (k: string) => string; busy: boolean; identifier: string; kind: string; verifiedPhone: boolean; verifiedEmail: string | null; sentTo: string;
  onSubmit: (d: { fullName: string; phone?: string; email?: string; password: string; confirm: string }) => void;
}) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(kind === "phone" ? identifier : "");
  const [mail, setMail] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ fullName: name, phone: phone || undefined, email: verifiedEmail ? undefined : mail || undefined, password: pw, confirm: pw2 }); }}>
      <VerifiedPill tr={tr} sentTo={sentTo} />
      <div className="mb-5"><H1>{tr("new_title")}</H1></div>
      <div className="space-y-4">
        <div><label htmlFor="v5-name" className={LABEL}>{tr("name")}</label>
          <div className={FIELD}><span className="text-[#5d6b7e] dark:text-[#93a3bd]"><Icon n="user" s={18} /></span><input id="v5-name" autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("name_ph")} className={INPUT} /></div></div>
        {!verifiedPhone && (
          <div><label htmlFor="v5-phone" className={LABEL}>{tr("mobile")}</label>
            <div className={FIELD}><IdPrefix value="" /><input id="v5-phone" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" className={INPUT} /></div></div>
        )}
        {verifiedPhone && !verifiedEmail && (
          <div><label htmlFor="v5-mail" className={LABEL}>{tr("email_opt")}</label>
            <div className={FIELD}><span className="text-[#5d6b7e] dark:text-[#93a3bd]"><Icon n="mail" s={18} /></span><input id="v5-mail" dir="ltr" type="email" autoComplete="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="name@example.com" className={INPUT} /></div></div>
        )}
        <PwField id="v5-pw1" label={tr("pw_new")} value={pw} onChange={setPw} autoComplete="new-password" showLabel={tr("show")} below={<Strength pw={pw} tr={tr} />} />
        <PwField id="v5-pw2" label={tr("pw_again")} value={pw2} onChange={setPw2} autoComplete="new-password" showLabel={tr("show")} below={<Match a={pw} b={pw2} tr={tr} />} />
      </div>
      <button type="submit" disabled={busy || !name.trim() || !pw || !pw2} className={CTA}>{busy ? tr("wait") : tr("create")}</button>
    </form>
  );
}

function NewPasswordStep({ tr, busy, sentTo, password, setPassword, onSubmit }: {
  tr: (k: string) => string; busy: boolean; sentTo: string; password: string; setPassword: (v: string) => void; onSubmit: (pw: string, c: string) => void;
}) {
  const [pw2, setPw2] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(password, pw2); }}>
      <VerifiedPill tr={tr} sentTo={sentTo} />
      <H1>{tr("reset_title")}</H1>
      <p className={`mb-6 mt-2 text-[15px] ${MUTED}`}>{tr("reset_p")}</p>
      <div className="space-y-4">
        <PwField id="v5-np1" label={tr("pw_new")} value={password} onChange={setPassword} autoComplete="new-password" autoFocus showLabel={tr("show")} below={<Strength pw={password} tr={tr} />} />
        <PwField id="v5-np2" label={tr("pw_again")} value={pw2} onChange={setPw2} autoComplete="new-password" showLabel={tr("show")} below={<Match a={password} b={pw2} tr={tr} />} />
      </div>
      <button type="submit" disabled={busy || !password || !pw2} className={CTA}>{busy ? tr("wait") : tr("save_pw")}</button>
    </form>
  );
}

function Badge({ n }: { n: IconName }) {
  return <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eef6f1] text-[#157a4b] dark:bg-[#13284a] dark:text-[#3fc483]"><Icon n={n} s={18} /></span>;
}

function Footer({ tr }: { tr: (k: string) => string }) {
  return (
    <div className="mt-5 flex flex-col items-center gap-2.5 px-1.5 text-[13px] text-[#5d6b7e] dark:text-[#93a3bd] sm:flex-row sm:justify-between">
      <a href="https://wa.me/923226275476" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-[#0d1b2e] dark:hover:text-white"><WaMark />{tr("help")} <bdi dir="ltr" className="font-v5 font-semibold text-[#0d1b2e] dark:text-[#eef3f8]">0322 6275476</bdi></a>
      <span className="flex gap-4"><a href="/terms-and-conditions" className="hover:underline">{tr("terms")}</a><a href="/privacy-policy" className="hover:underline">{tr("privacy")}</a></span>
    </div>
  );
}

function Arrow({ rtl, s = 18 }: { rtl: boolean; s?: number }) { return <Icon n={rtl ? "arrowL" : "arrowR"} s={s} />; }

type IconName = "lock" | "mail" | "user" | "phone" | "arrowR" | "arrowL" | "eye" | "eyeoff" | "clock" | "check" | "key" | "shield" | "chat";
const PATHS: Record<IconName, string> = {
  lock: "M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  phone: "M7 3h10v18H7zM11 18h2",
  arrowR: "M5 12h14M13 6l6 6-6 6",
  arrowL: "M19 12H5M11 6l-6 6 6 6",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeoff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  check: "M5 12l5 5 9-10",
  key: "M8 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM11 12l9-9M17 6l3 3",
  shield: "M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3zM9 12l2 2 4-4",
  chat: "M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1zM9 10h6M9 13h4",
};
export function Icon({ n, s = 20 }: { n: IconName; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[n]} /></svg>;
}
function WaMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /><path fill="#fff" d="M16.8 14.2c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z" /></svg>;
}
function PkFlag() {
  return <svg width="20" height="14" viewBox="0 0 30 20" aria-hidden="true" className="rounded-[2px]"><rect width="30" height="20" fill="#fff" /><rect x="7.5" width="22.5" height="20" fill="#01411C" /><circle cx="19" cy="10" r="5" fill="#fff" /><circle cx="20.5" cy="8.8" r="4.3" fill="#01411C" /><path d="M22 6.5l.6 1.4 1.5.1-1.2.9.4 1.5-1.3-.8-1.3.8.4-1.5-1.2-.9 1.5-.1z" fill="#fff" /></svg>;
}
