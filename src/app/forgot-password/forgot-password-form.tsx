"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { requestPasswordReset, type ActionState } from "@/actions/password-reset";
import {
  requestPhoneResetOtp, verifyResetOtp, setPasswordWithResetToken, type PhoneResetState,
} from "@/actions/password-reset-otp";

const FIELD = "h-12 w-full rounded-xl border border-surface-200 bg-white px-3.5 text-[15px] shadow-sm outline-none transition focus:border-[#2E6840] focus:ring-2 focus:ring-[#2E6840]/10 placeholder:text-surface-400 dark:border-slate-600 dark:bg-[#0B1426] dark:text-white";
const BTN = "h-12 w-full rounded-xl bg-[#174B2B] text-[15px] font-semibold tracking-wide text-white shadow-sm transition hover:bg-[#123D23] disabled:cursor-not-allowed disabled:opacity-60";
const LABEL = "mb-1.5 block text-sm font-medium text-surface-700 dark:text-slate-300";
const HINT = "text-xs leading-relaxed text-[#5B6F62] dark:text-slate-400";

/**
 * Password bhool gaye -- do raaste: WhatsApp OTP (mobile se bane account,
 * kisan, staff) aur Email link. Har jawab "agar registered hai" wala hai,
 * taake koi number/email daal kar ye na jaan sake ke account hai ya nahi.
 */
export function ForgotPasswordForm() {
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfcf8] px-4 py-8 dark:bg-[#0B1426]">
      <div className="w-full max-w-[440px]">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#123d2a] font-display text-sm font-bold text-[#e5c65b] shadow-lg">AR</Link>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#103b29] dark:text-white">Password bhool gaye?</h1>
            <p className="text-sm text-[#66766b] dark:text-slate-400">Reset ka tareeqa chunein</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-[#e1e6de] bg-white/95 p-5 shadow-[0_24px_70px_-30px_rgba(13,40,24,0.32)] dark:border-[#22314F] dark:bg-[#111D35] sm:p-6">
          <div role="tablist" aria-label="Reset ka tareeqa" className="mb-5 grid grid-cols-2 gap-2">
            {([["whatsapp", "WhatsApp OTP", "Registered mobile par 6 hindse code"], ["email", "Email link", "Registered email par reset link"]] as const).map(([key, title, body]) => (
              <button key={key} type="button" role="tab" aria-selected={channel === key} onClick={() => setChannel(key)}
                className={`rounded-2xl border p-3 text-left transition ${channel === key ? "border-2 border-[#174B2B] bg-[#E9F4EC] dark:border-emerald-400 dark:bg-emerald-900/25" : "border-[#E1E6DE] hover:border-[#9CBFA6] dark:border-slate-700"}`}>
                <span className="block text-sm font-bold text-[#123d2a] dark:text-white">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#5B6F62] dark:text-slate-400">{body}</span>
              </button>
            ))}
          </div>
          {channel === "whatsapp" ? <PhoneFlow /> : <EmailFlow onPhone={() => setChannel("whatsapp")} />}
          <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-[#1E4A2E] hover:underline dark:text-emerald-300">← Login par wapas</Link>
        </div>
      </div>
    </main>
  );
}

function Steps({ active }: { active: 1 | 2 | 3 }) {
  const labels = ["Mobile", "OTP", "Naya password"];
  return (
    <ol className="mb-4 grid grid-cols-3 gap-1.5" aria-label="Reset ke qadam">
      {labels.map((l, i) => {
        const n = i + 1;
        const cls = n === active
          ? "border-[#174B2B] bg-[#E9F4EC] font-bold text-[#174B2B] dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200"
          : n < active ? "border-[#CFE3D5] text-[#2E6840] dark:border-slate-600 dark:text-emerald-300" : "border-[#E1E6DE] text-[#7A8A80] dark:border-slate-700 dark:text-slate-400";
        return <li key={l} aria-current={n === active ? "step" : undefined} className={`rounded-lg border px-2 py-1.5 text-center text-[11px] ${cls}`}>{n < active ? "✓" : n} · {l}</li>;
      })}
    </ol>
  );
}

function Alert({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`mb-3 rounded-xl px-3 py-2.5 text-sm ${tone === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200" : "bg-[#E9F4EC] text-[#174B2B] dark:bg-emerald-900/30 dark:text-emerald-200"}`}>{children}</p>
  );
}

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={BTN}>{pending ? busy : label}</button>;
}

const empty: PhoneResetState = {};

function PhoneFlow() {
  const [s1, ask] = useFormState(requestPhoneResetOtp, empty);
  const [s2, check] = useFormState(verifyResetOtp, empty);
  const [s3, save] = useFormState(setPasswordWithResetToken, empty);
  const [cur, setCur] = useState<PhoneResetState>(empty);
  const [phone, setPhone] = useState("");
  const [left, setLeft] = useState(0);
  useEffect(() => { if (s1 !== empty) setCur(s1); }, [s1]);
  useEffect(() => { if (s2 !== empty) setCur(s2); }, [s2]);
  useEffect(() => { if (s3 !== empty) setCur(s3); }, [s3]);
  // 5 minute ka ulta timer jab code bheja jaye.
  useEffect(() => { if (s1.step === "code") setLeft(300); }, [s1]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const step = cur.step ?? "phone";
  if (step === "done") {
    return (
      <div className="text-center">
        <Alert tone="ok">{cur.message}</Alert>
        <p className={HINT}>Baqi tamam devices se logout kar diya gaya hai.</p>
        <Link href="/login" className={`${BTN} mt-4 flex items-center justify-center`}>Login karein</Link>
      </div>
    );
  }
  if (step === "password") {
    return (
      <form action={save} className="space-y-3">
        <Steps active={3} />
        {cur.error && <Alert tone="error">{cur.error}</Alert>}
        <input type="hidden" name="grant" value={cur.grant ?? ""} />
        <div><label htmlFor="np" className={LABEL}>Naya password</label><input id="np" name="password" type="password" required minLength={8} autoComplete="new-password" className={FIELD} placeholder="Kam az kam 8 characters" /></div>
        <div><label htmlFor="np2" className={LABEL}>Password dobara</label><input id="np2" name="password_confirm" type="password" required minLength={8} autoComplete="new-password" className={FIELD} /></div>
        <p className={HINT}>Password badalte hi baqi tamam devices se logout ho jayega.</p>
        <Submit label="Password badlein" busy="Badla ja raha hai..." />
      </form>
    );
  }
  if (step === "code") {
    const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    return (
      <div>
        <Steps active={2} />
        {cur.error ? <Alert tone="error">{cur.error}</Alert> : cur.message && <Alert tone="ok">{cur.message}</Alert>}
        <form action={check} className="space-y-3">
          <input type="hidden" name="phone" value={cur.phone ?? phone} />
          <label htmlFor="otp" className={LABEL}>{cur.masked ?? ""} par aaya 6 hindse code</label>
          <input id="otp" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="- - - - - -" className={`${FIELD} text-center font-mono text-xl tracking-[0.35em]`} />
          <p className={HINT}>{left > 0 ? `Code ${mm} mein khatam hoga` : "Code ki muddat khatam ho sakti hai"} · 3 ghalat koshishon ke baad naya code mangwana hoga.</p>
          <Submit label="Code tasdeeq karein" busy="Check ho raha hai..." />
        </form>
        <form action={ask} className="mt-3 text-center">
          <input type="hidden" name="phone" value={cur.phone ?? phone} />
          <button type="submit" className="text-xs font-semibold text-[#1E4A2E] hover:underline dark:text-emerald-300">Code nahi aaya? Dobara bhejein (60 second baad)</button>
        </form>
      </div>
    );
  }
  return (
    <form action={ask} className="space-y-3">
      <Steps active={1} />
      {cur.error && <Alert tone="error">{cur.error}</Alert>}
      <div>
        <label htmlFor="fp-phone" className={LABEL}>Registered mobile number</label>
        <input id="fp-phone" name="phone" required inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" className={FIELD} />
      </div>
      <Submit label="WhatsApp par code bhejein" busy="Bheja ja raha hai..." />
      <p className={HINT}>Agar ye number registered hai to code 5 minute ke liye bheja jayega.</p>
    </form>
  );
}

function EmailFlow({ onPhone }: { onPhone: () => void }) {
  const [state, action] = useFormState(requestPasswordReset, {} as ActionState);
  if (state.success) {
    return <div><Alert tone="ok">{state.message}</Alert><p className={HINT}>Link sirf ek dafa chalega.</p></div>;
  }
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <label htmlFor="fp-email" className={LABEL}>Email</label>
        <input id="fp-email" type="email" name="email" required autoComplete="email" placeholder="name@alranatraders.pk" className={FIELD} />
      </div>
      <Submit label="Reset link bhejein" busy="Bheja ja raha hai..." />
      <p className={HINT}>Agar ye email registered hai to link 30 minute ke liye bheja jayega. Spam folder bhi dekhein.</p>
      <p className={HINT}>Account mobile se bana hai? <button type="button" onClick={onPhone} className="font-semibold text-[#1E4A2E] underline dark:text-emerald-300">WhatsApp OTP</button> chunein.</p>
    </form>
  );
}
