"use client";

import type { ReactNode } from "react";
import { tx, type V5Lang } from "@/app/login/v5-text";
import { attemptsRemaining, digitsFilled, formatCountdown, otherChannels, OTP_LENGTH, type OtpChannelName } from "@/lib/auth/otp-ui";

export const OTP_MOTION_CSS = `
@keyframes otp-blink { 50% { opacity: 0 } }
@keyframes otp-shake { 20%, 60% { transform: translateX(-8px) } 40%, 80% { transform: translateX(8px) } }
@keyframes otp-pop { 0% { transform: scale(.3); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
@keyframes otp-draw { from { stroke-dashoffset: 60 } to { stroke-dashoffset: 0 } }
.otp-caret { animation: otp-blink 1s step-end infinite }
.otp-shake { animation: otp-shake .45s ease-in-out 2 }
.otp-pop { animation: otp-pop .6s ease-out both }
.otp-draw { stroke-dasharray: 60; stroke-dashoffset: 60; animation: otp-draw .55s ease-out .25s forwards }
@media (prefers-reduced-motion: reduce) {
  .otp-caret, .otp-shake, .otp-pop, .otp-draw { animation: none !important }
  .otp-draw { stroke-dashoffset: 0 }
}
`;

const CH_KEY: Record<OtpChannelName, string> = { whatsapp: "ch_whatsapp", sms: "ch_sms", email: "ch_email" };

export type OtpGlassyProps = {
  lang: V5Lang;
  sentTo: string;
  channel: OtpChannelName;
  channels: OtpChannelName[];
  digits: string[];
  focus: number;
  busy: boolean;
  resendLeft: number;
  fails: number;
  errorKey: string | null;
  verified: boolean;
  shake: number;
  langToggle?: ReactNode;
  inputRef?: (index: number, el: HTMLInputElement | null) => void;
  onDigit: (index: number, raw: string) => void;
  onBackspace: (index: number) => void;
  onFocus: (index: number) => void;
  onVerify: () => void;
  onResend: () => void;
  onSwitchChannel: () => void;
  onBack: () => void;
  onContinue: () => void;
};

function line(lang: V5Lang, key: string, vars?: Record<string, string | number>) {
  return tx(lang, key, vars);
}

export function OtpGlassy(p: OtpGlassyProps) {
  const code = p.digits.join("");
  const filled = digitsFilled(p.digits);
  const wrong = p.errorKey === "e_code_wrong" || p.errorKey === "e_code_locked" || p.errorKey === "e_code_expired";
  const showError = wrong && !p.verified;
  const leftTries = attemptsRemaining(p.fails);
  const others = otherChannels(p.channels, p.channel);
  const ready = code.length === OTP_LENGTH && !p.busy;
  const state = p.verified ? "verified" : showError ? "error" : filled > 0 ? "partial" : "empty";

  return (
    <div data-otp="glassy" data-state={state}>
      <style>{OTP_MOTION_CSS}</style>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={p.onBack} data-action="otp-back" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#137043] hover:underline dark:text-[#3fc483]">
          <span aria-hidden="true">←</span>
          <span>{line("rm", "otp_back")} / {line("en", "otp_back")}</span>
          <span className="font-urdu text-[12px] font-normal text-[#5b6b82] dark:text-[#93a3bd]">{line("ur", "otp_back")}</span>
        </button>
        {p.langToggle}
      </div>

      {p.verified ? (
        <Verified lang={p.lang} sentTo={p.sentTo} busy={p.busy} onContinue={p.onContinue} />
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (ready) p.onVerify(); }}>
          <p className="mt-[18px] text-[10.5px] font-semibold uppercase tracking-[0.4px] text-[#7a889c]">{line("en", "otp_kicker")}</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <h1 className={`${p.lang === "ur" ? "font-urdu leading-[1.8]" : "font-v5display"} text-[24px] font-semibold tracking-[-0.02em] text-[#0f1f3a] dark:text-[#eef3f8]`}>{line(p.lang, "otp_heading")}</h1>
            {p.lang === "ur"
              ? <p className="shrink-0 text-[13px] text-[#5b6b82]">{line("rm", "otp_heading")}</p>
              : <p className="shrink-0 font-urdu text-[15px] leading-[2.2] text-[#5b6b82] dark:text-[#93a3bd]" dir="rtl">{line("ur", "otp_heading")}</p>}
          </div>
          {p.lang === "en" && <p className="text-[13px] text-[#5b6b82]">{line("rm", "otp_heading")}</p>}

          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#0f1f3a]/10 bg-white/70 px-3 py-2 text-[13px] text-[#4a5a72] dark:border-white/10 dark:bg-white/5 dark:text-[#c3cee0]">
            <ChanIcon channel={p.channel} />
            <span>{line(p.lang, "otp_sent_chip")}:</span>
            <bdi dir="ltr" className="font-v5 font-semibold text-[#137043] dark:text-[#3fc483]">{line("en", CH_KEY[p.channel])} {p.sentTo}</bdi>
          </div>

          <div dir="ltr" key={p.shake} className={`mt-6 grid grid-cols-6 gap-1.5 sm:gap-2.5 ${showError && p.errorKey === "e_code_wrong" ? "otp-shake" : ""}`} role="group" aria-label={line(p.lang, "otp_enter")}>
            {p.digits.map((d, i) => {
              const box = showError && d ? "error" : d ? "filled" : i === p.focus ? "current" : "empty";
              return (
                <label key={i} className={boxClass(box)} data-box={box}>
                  <input
                    ref={(el) => p.inputRef?.(i, el)}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    pattern="[0-9]*"
                    maxLength={OTP_LENGTH}
                    aria-label={line(p.lang, "otp_digit", { n: i + 1 })}
                    className="h-full w-full border-0 bg-transparent text-center font-v5 text-[22px] font-bold text-inherit outline-none sm:text-[26px]"
                    onFocus={() => p.onFocus(i)}
                    onChange={(e) => p.onDigit(i, e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text.replace(/\D/g, "").length > 1) {
                        e.preventDefault();
                        p.onDigit(i, text);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        e.preventDefault();
                        p.onBackspace(i);
                      } else if (e.key === "ArrowLeft" && i > 0) {
                        e.preventDefault();
                        p.onFocus(i - 1);
                      } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
                        e.preventDefault();
                        p.onFocus(i + 1);
                      }
                    }}
                  />
                  {box === "current" && <span aria-hidden="true" className="otp-caret pointer-events-none absolute left-1/2 top-1/2 h-[26px] w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#1f3a6b] dark:bg-[#9db4e6]" />}
                </label>
              );
            })}
          </div>

          <div className="mt-2 min-h-[20px] text-[12.5px] leading-5">
            {showError ? (
              <p role="alert" className="font-semibold text-[#b42323]">
                <span aria-hidden="true">✕ </span>
                {p.errorKey === "e_code_wrong" ? (
                  <>
                    {line("rm", "otp_wrong")} · {line("en", "otp_wrong")} ({line("rm", "otp_tries", { n: leftTries })})
                    <span className="mt-0.5 block font-urdu text-[13px] font-normal leading-[1.8]" dir="rtl">{line("ur", "otp_wrong")} · {line("ur", "otp_tries", { n: leftTries })}</span>
                  </>
                ) : (
                  <>
                    {line("rm", p.errorKey!)} · {line("en", p.errorKey!)}
                    <span className="mt-0.5 block font-urdu text-[13px] font-normal leading-[1.8]" dir="rtl">{line("ur", p.errorKey!)}</span>
                  </>
                )}
              </p>
            ) : filled === 0 ? (
              <p className="text-[#7a889c]">
                {line("rm", "otp_enter")} · {line("en", "otp_enter")}
                <span className="mt-0.5 block font-urdu text-[13px] leading-[1.8] text-[#5b6b82]" dir="rtl">{line("ur", "otp_enter")}</span>
              </p>
            ) : (
              <p className="font-medium text-[#137043] dark:text-[#3fc483]">
                {line("rm", "otp_left", { n: OTP_LENGTH - filled })} · {line("en", "otp_left", { n: OTP_LENGTH - filled })}
                <span className="mt-0.5 block font-urdu font-normal leading-[1.8]" dir="rtl">{line("ur", "otp_left", { n: OTP_LENGTH - filled })}</span>
              </p>
            )}
          </div>

          <button type="submit" disabled={!ready} data-action="verify" className={`mt-3.5 flex h-12 w-full items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1f9d5c] to-[#137043] text-[14.5px] font-semibold text-white shadow-[0_10px_26px_rgba(31,157,92,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none motion-reduce:transition-none`}>
            {p.busy ? line(p.lang, "wait") : <>{line("en", "verify")} · {line("rm", "verify")}</>}
          </button>

          <p className="mt-4 text-center text-[13px] leading-6 text-[#4a5a72] dark:text-[#93a3bd]">
            {line("rm", "otp_miss")} {line("en", "otp_miss")}{" "}
            <span dir="ltr" className="inline-flex items-center gap-1 font-v5 font-bold text-[#0f1f3a] dark:text-white">
              <ClockIcon /> {formatCountdown(p.resendLeft)}
            </span>{" "}
            <button type="button" data-action="resend" onClick={p.onResend} disabled={p.resendLeft > 0 || p.busy} className="font-semibold text-[#137043] enabled:hover:underline disabled:opacity-50 dark:text-[#3fc483]">{line("en", "otp_resend")}</button>
            <span className="mt-0.5 block font-urdu text-[13px] leading-[1.8] text-[#5b6b82]" dir="rtl">{line("ur", "otp_miss")}</span>
          </p>

          <p className="mt-2 text-center text-[12.5px] text-[#4a5a72]">
            <button type="button" data-action="switch-channel" data-others={others.join("/")} onClick={p.onSwitchChannel} className="font-semibold text-[#1f3a6b] underline dark:text-[#9db4e6]">{line("rm", "otp_switch")}</button>
            {others.length > 0 && <span> · {others.map((c) => line("en", CH_KEY[c])).join(" / ")}</span>}
            <span className="mt-0.5 block font-urdu text-[13px] leading-[1.8] text-[#5b6b82]" dir="rtl">{line("ur", "otp_switch")}</span>
          </p>
        </form>
      )}
    </div>
  );
}

function Verified({ lang, sentTo, busy, onContinue }: { lang: V5Lang; sentTo: string; busy: boolean; onContinue: () => void }) {
  return (
    <div className="px-1 pb-1 pt-6 text-center" data-state="verified">
      <div className="otp-pop mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#4fd08a,#1f9d5c_60%,#137043)] shadow-[0_0_0_10px_rgba(31,157,92,0.12),0_0_40px_rgba(31,157,92,0.5)]">
        <svg viewBox="0 0 52 52" className="h-12 w-12" aria-hidden="true">
          <path className="otp-draw" d="M14 27l8 8 16-17" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-[#7a889c]">{line("en", "otp_ok_kicker")}</p>
      <h1 className={`mt-1 text-[24px] font-semibold text-[#0f1f3a] dark:text-[#eef3f8] ${lang === "ur" ? "font-urdu leading-[1.8]" : "font-v5display"}`}>{line(lang, "otp_ok_heading")}</h1>
      <p className="font-urdu text-[13px] leading-[1.8] text-[#5b6b82]" dir="rtl">{line("ur", "otp_ok_heading")}</p>
      <p className="mx-auto mt-2.5 max-w-[320px] text-[13.5px] leading-6 text-[#4a5a72] dark:text-[#c3cee0]">
        {line("rm", "otp_ok_p", { n: sentTo })}
        <span className="mt-1 block text-[12.5px] text-[#7a889c]">{line("en", "otp_ok_p", { n: sentTo })}</span>
        <span className="mt-1 block font-urdu text-[13px] leading-[1.8]" dir="rtl">{line("ur", "otp_ok_p", { n: sentTo })}</span>
      </p>
      <button type="button" data-action="continue" onClick={onContinue} disabled={busy} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-[#1f9d5c] to-[#137043] text-[14.5px] font-semibold text-white shadow-[0_10px_26px_rgba(31,157,92,0.35)] hover:brightness-105 disabled:opacity-60">
        {line("rm", "otp_go")} · {line("en", "otp_go")} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function boxClass(box: "empty" | "filled" | "current" | "error") {
  const base = "relative flex h-[52px] items-center justify-center rounded-[15px] border-[1.5px] bg-white/45 text-[#0f3a2e] shadow-[inset_0_1px_0_#fff,0_6px_16px_rgba(15,31,58,0.07)] backdrop-blur-[10px] transition duration-300 motion-reduce:transition-none dark:bg-white/5 dark:text-[#e7f6ee] sm:h-[62px]";
  if (box === "error") return `${base} border-[#d93a3a] bg-[rgba(255,235,235,0.72)] text-[#b42323] shadow-[0_0_0_4px_rgba(217,58,58,0.13),0_0_18px_rgba(217,58,58,0.35)]`;
  if (box === "filled") return `${base} border-[#1f9d5c] text-[#0f3a2e] shadow-[0_0_0_4px_rgba(31,157,92,0.15),0_0_22px_rgba(31,157,92,0.45),inset_0_1px_0_#fff]`;
  if (box === "current") return `${base} border-[#1f3a6b] shadow-[0_0_0_4px_rgba(31,58,107,0.12)]`;
  return `${base} border-white/90 dark:border-white/15`;
}

function ChanIcon({ channel }: { channel: OtpChannelName }) {
  if (channel === "whatsapp") {
    return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /></svg>;
  }
  const d = channel === "sms" ? "M4 5h16v10H7l-3 3V5z" : "M3 5h18v14H3zM3 7l9 6 9-6";
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#137043" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function ClockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
}
