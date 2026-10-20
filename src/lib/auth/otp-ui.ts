/**
 * Login v5 OTP boxes — sirf UI. Server ka code, hadd aur lock yahan nahi.
 * Teen ghalat ke baad server `band` bhejta hai (fn_verify_farmer_otp).
 */
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 3;

export type OtpChannelName = "whatsapp" | "sms" | "email";

export type OtpDigitState = {
  digits: string[];
  focus: number;
  /** Poora 6-hinda code, warna null (abhi verify nahi). */
  submit: string | null;
};

export function emptyOtpDigits(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

/** Ek hinda, ya paste / autofill ka poora code. Gair-hindse hat jate hain. */
export function applyOtpInput(digits: string[], index: number, raw: string): OtpDigitState {
  const i = Math.min(Math.max(0, index), OTP_LENGTH - 1);
  let v = String(raw ?? "").replace(/\D/g, "");
  const current = digits[i] ?? "";
  // Controlled box pehle se ek hinda rakhta hai; agla key "48" ban jata hai — naya hinda lo.
  if (current && v.length === current.length + 1 && v.startsWith(current)) v = v.slice(-1);
  if (v.length > 1) {
    const next = v.slice(0, OTP_LENGTH).split("");
    while (next.length < OTP_LENGTH) next.push("");
    const filled = Math.min(OTP_LENGTH, v.length);
    return {
      digits: next,
      focus: Math.min(OTP_LENGTH - 1, filled),
      submit: v.length >= OTP_LENGTH ? v.slice(0, OTP_LENGTH) : null,
    };
  }
  const next = digits.slice();
  next[i] = v.slice(0, 1);
  const code = next.join("");
  return {
    digits: next,
    focus: v && i < OTP_LENGTH - 1 ? i + 1 : i,
    submit: code.length === OTP_LENGTH ? code : null,
  };
}

/** Backspace: is khane ko khali karo; khali ho to pichhla hinda mitao. */
export function applyOtpBackspace(digits: string[], index: number): OtpDigitState {
  const next = digits.slice();
  const i = Math.min(Math.max(0, index), OTP_LENGTH - 1);
  if (next[i]) {
    next[i] = "";
    return { digits: next, focus: i, submit: null };
  }
  if (i > 0) {
    next[i - 1] = "";
    return { digits: next, focus: i - 1, submit: null };
  }
  return { digits: next, focus: 0, submit: null };
}

export function digitsFilled(digits: string[]): number {
  return digits.filter((d) => d !== "").length;
}

/** Is session ki ghalat koshishein. Server ki hadd 3 hai. */
export function attemptsRemaining(fails: number, max = OTP_MAX_ATTEMPTS): number {
  const n = Number.isFinite(fails) ? fails : 0;
  return Math.max(0, max - Math.max(0, Math.floor(n)));
}

export function otherChannels<T extends string>(allowed: readonly T[], current: T): T[] {
  return allowed.filter((c) => c !== current);
}

export function resendLeftSeconds(resendAt: number, now: number): number {
  return Math.max(0, Math.ceil((resendAt - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
