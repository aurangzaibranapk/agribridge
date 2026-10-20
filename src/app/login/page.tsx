import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { LoginV5 } from "@/app/login/login-v5";
import { LegacyLoginPage } from "@/app/login/legacy-page";
import { tx, type V5Lang } from "@/app/login/v5-text";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

const v5 = localFont({ src: [{ path: "./fonts/inter-var.woff2", weight: "100 900", style: "normal" }], variable: "--font-v5", display: "swap" });
const v5display = localFont({ src: [{ path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" }], variable: "--font-v5display", display: "swap" });
const urdu = localFont({ src: [{ path: "./fonts/noto-nastaliq-urdu.woff2", weight: "400 700", style: "normal" }], variable: "--font-urdu", display: "swap" });

/**
 * Login v5 (malik ki manzoori, 20 Oct): mobile / User ID / email + password.
 * OTP sirf naye signup, pehli dafa password aur password bhool gaye par.
 * Wapsi ka raasta: server .env mein LOGIN_V5=0 -> purana login (legacy-page.tsx).
 */
export default async function LoginPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (process.env.LOGIN_V5 === "0") return <LegacyLoginPage />;
  const rawOtp = Array.isArray(searchParams?.otp) ? searchParams?.otp[0] : searchParams?.otp;
  // Dev-only visual fixture (screenshots). Production build strips it; no grant, no OTP send.
  const otpPreview = process.env.NODE_ENV !== "production" && rawOtp && ["empty", "typing", "error", "verified"].includes(rawOtp) ? rawOtp : null;
  const cookieLang = getLanguageFromCookies("rm");
  const lang: V5Lang = cookieLang === "en" || cookieLang === "ur" ? cookieLang : "rm";
  const rtl = lang === "ur";
  const tr = (k: string) => tx(lang, k);
  const trust: [string, string, string][] = [["shield", "t1a", "t1b"], ["users", "t2a", "t2b"], ["chat", "t3a", "t3b"]];
  return (
    <main className={`${v5.variable} ${v5display.variable} ${urdu.variable} min-h-screen bg-[#eef4f1] font-v5 text-[#0d1b2e] antialiased dark:bg-[#0a1324] dark:text-[#eef3f8] lg:grid lg:h-screen lg:min-h-0 lg:grid-cols-[47%_53%] lg:overflow-hidden`}>
      <aside className="relative hidden overflow-hidden bg-[radial-gradient(120%_80%_at_0%_0%,#1d6b47_0%,transparent_55%),radial-gradient(90%_70%_at_100%_100%,#14396b_0%,transparent_60%),linear-gradient(160deg,#0f3d2a,#0c2340)] px-16 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <Fields />
        <div className="relative">
          <Brand />
          <div dir={rtl ? "rtl" : "ltr"} className={rtl ? "font-urdu" : ""}>
            <h2 className={`mt-28 max-w-[560px] ${rtl ? "text-[40px] leading-[1.7]" : "font-v5display text-[46px] font-semibold leading-[1.12] tracking-[-0.02em]"}`}>{tr("tag")}</h2>
            <p className={`mt-4 max-w-[470px] text-[17px] text-[#c4d8cd] ${rtl ? "leading-[2]" : "leading-relaxed"}`}>{tr("sub")}</p>
          </div>
        </div>
        <ul dir={rtl ? "rtl" : "ltr"} className={`relative grid gap-3.5 ${rtl ? "font-urdu justify-items-start" : ""}`}>
          {trust.map(([icon, a, b]) => (
            <li key={a} className="flex w-[400px] items-center gap-3.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-[18px] py-3.5 backdrop-blur-md">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[#f3d27a]/[0.14] text-[#f3d27a]"><TrustIcon n={icon} /></span>
              <div><p className="text-[15px] font-semibold">{tr(a)}</p><p className="text-[13px] text-[#b6cabf]">{tr(b)}</p></div>
            </li>
          ))}
        </ul>
      </aside>
      <section className="relative flex min-h-screen flex-col items-center overflow-x-hidden bg-[#eef4f1] px-5 py-7 dark:bg-[#0a1324] lg:min-h-0 lg:justify-center lg:overflow-y-auto lg:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-24 h-[380px] w-[380px] rounded-full bg-[#7fd6a6] opacity-55 blur-[80px] dark:opacity-20" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-10 h-[340px] w-[340px] rounded-full bg-[#9db4e6] opacity-55 blur-[80px] dark:opacity-20" />
        <div className="relative z-10 mb-6 flex w-full max-w-[440px] items-center gap-3 lg:hidden"><Logo id="ablg-m" /><div><p className="font-v5display text-[19px] font-semibold">AgriBridge</p><p className={`text-[12px] text-[#5d6b7e] dark:text-[#93a3bd] ${rtl ? "font-urdu" : ""}`}>{tr("tag")}</p></div></div>
        <div className="relative z-10 w-full max-w-[440px]"><Suspense fallback={null}><LoginV5 initialLang={lang} preview={otpPreview} /></Suspense></div>
      </section>
    </main>
  );
}

function Brand() {
  return <div className="flex items-center gap-3.5"><Logo /><div><p className="font-v5display text-[22px] font-semibold tracking-[-0.01em]">AgriBridge</p><p className="text-[12.5px] text-[#a9cdb9]">by Al Rana Traders</p></div></div>;
}
function Logo({ id = "ablg" }: { id?: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f7a4d" /><stop offset="1" stopColor="#0f3d2a" /></linearGradient></defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <path d="M24 36V17" stroke="#f3d27a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 24c-6 0-9-3.5-9.5-8.5 6 .3 9.2 3.6 9.5 8.5zM24 30c6 0 9-3.5 9.5-8.5-6 .3-9.2 3.6-9.5 8.5z" fill="#f3d27a" />
      <path d="M15 36h18" stroke="#9fd6b0" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function Fields() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full" viewBox="0 0 720 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 300C160 240 300 270 420 250S640 190 720 200V420H0Z" fill="#fff" opacity=".05" />
      <path d="M0 340C140 300 280 330 400 310S620 270 720 280V420H0Z" fill="#fff" opacity=".07" />
      <g stroke="#fff" strokeOpacity=".08" strokeWidth="1.5" fill="none">
        {Array.from({ length: 13 }, (_, i) => -100 + i * 70).map((x) => <path key={x} d={`M${x} 420 Q${x + 60} 330 ${x + 160} 300`} />)}
      </g>
    </svg>
  );
}
function TrustIcon({ n }: { n: string }) {
  const d = n === "shield" ? "M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3zM9 12l2 2 4-4"
    : n === "users" ? "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M17 11.5a2.5 2.5 0 1 0 0-5M16 14.6c2.8.3 5 2.3 5 5.4"
    : "M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1zM9 10h6M9 13h4";
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
