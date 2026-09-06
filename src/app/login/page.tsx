import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";

export default function LoginPage() {
  const lang = getLanguageFromCookies("ur");

  return (
    <LangProvider lang={lang}>
      <main className="min-h-screen bg-[#071d12] lg:grid lg:grid-cols-[46%_54%]">
        <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 bg-[#0b2b1a] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-28 h-[32rem] w-[32rem] rounded-full bg-[#d4af37]/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-[#2d7046]/30 blur-3xl" />
            <svg className="absolute inset-x-0 bottom-0 h-[42%] w-full opacity-[0.12]" viewBox="0 0 800 360" preserveAspectRatio="xMidYMax slice" fill="none">
              <path d="M0 260C120 205 210 285 330 230C450 175 540 260 800 180V360H0V260Z" fill="#d4af37" />
              <path d="M0 300C150 255 260 330 410 270C560 215 650 280 800 245V360H0V300Z" fill="#2f7448" />
              <g stroke="#e7c75c" strokeWidth="3" strokeLinecap="round">
                <path d="M120 315V215" /><path d="M120 240c-25-4-38-20-40-43 25 3 39 18 40 43Z" /><path d="M120 265c25-4 38-20 40-43-25 3-39 18-40 43Z" />
                <path d="M640 320V205" /><path d="M640 235c-25-4-38-20-40-43 25 3 39 18 40 43Z" /><path d="M640 260c25-4 38-20 40-43-25 3-39 18-40 43Z" />
              </g>
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <BrandMark />
              <div>
                <p className="font-display text-xl font-semibold text-white">{t("au_company", lang)}</p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#e5c65b]">{t("au_brand", lang)}</p>
              </div>
            </div>

            <div className="mt-20 max-w-xl xl:mt-24">
              <span className="inline-flex rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-[#efd979]">
                Intelligent Agriculture Business Platform
              </span>
              <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white xl:text-5xl">
                Pakistan&apos;s Intelligent Agriculture Business Platform
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#b7cbbd] xl:text-lg">
                Farmer, Retail, Milk, Grain, Machinery aur Finance — sab ek jagah.
              </p>

              <div className="mt-9 grid max-w-lg grid-cols-2 gap-3">
                {[
                  ["Farmer Management", "One Farmer, One Profile"],
                  ["Retail & Inventory", "POS, stock aur purchasing"],
                  ["Milk & Grain", "Collection se settlement tak"],
                  ["Machinery & Finance", "Booking, khata aur payments"],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4af37]/12 text-[#e5c65b]">
                      <CheckMark />
                    </div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#91aa98]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-[#91aa98]">
            <span className="flex items-center gap-2"><ShieldMark /> Secure &amp; Verified</span>
            <span className="flex items-center gap-2"><BoltMark /> Fast Access</span>
            <span className="flex items-center gap-2"><HeadsetMark /> Farmer Support</span>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7f3] px-4 py-8 sm:px-8 lg:px-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#d4af37]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#1e4a2e]/10 blur-3xl" />

          <div className="relative w-full max-w-[470px]">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-3">
                <BrandMark compact />
                <div>
                  <p className="font-display text-base font-semibold text-[#123321]">{t("au_company", lang)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#9a7b16]">{t("au_brand", lang)}</p>
                </div>
              </div>
              <Link href="/" className="rounded-full border border-[#dfe5dc] bg-white px-3 py-2 text-xs font-semibold text-[#385442] shadow-sm">
                Website
              </Link>
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold text-[#2f6b45]">Welcome to AgriBridge</p>
              <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[#102c1c]">Apna account kholain</h2>
              <p className="mt-2 text-sm leading-6 text-[#66766b]">Farmer, customer, staff aur vendor — apna sahi login raasta chunain.</p>
            </div>

            <div className="rounded-[28px] border border-[#e1e6de] bg-[#fffefa] p-5 shadow-[0_24px_70px_-30px_rgba(13,40,24,0.32)] sm:p-7">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>

              <div className="mt-6 border-t border-[#e9ece7] pt-4">
                <div className="flex items-start gap-3 rounded-xl bg-[#f2f7f2] px-3.5 py-3">
                  <span className="mt-0.5 text-[#2f6b45]"><ShieldMark /></span>
                  <div>
                    <p className="text-xs font-semibold text-[#284a34]">Aapki maloomat mehfooz hai</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-[#708076]">OTP, account aur business data secure access ke sath use hota hai.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-[#758078]">
              <Link href="/" className="font-medium hover:text-[#1e4a2e]">Website par wapas</Link>
              <span>•</span>
              <span>{t("au_foot_safe", lang)}</span>
              <span>•</span>
              <span>{t("au_foot_support", lang)}</span>
            </div>
          </div>
        </section>
      </main>
    </LangProvider>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-11 w-11" : "h-14 w-14";
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/30 bg-[#123321] shadow-lg`}>
      <svg viewBox="0 0 64 64" className="h-9 w-9" fill="none">
        <path d="M32 5 54 17v25L32 55 10 42V17L32 5Z" stroke="#e5c65b" strokeWidth="2" />
        <path d="M32 45V20" stroke="#e5c65b" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 28c-8-1-11-6-11-12 7 1 11 5 11 12ZM32 35c8-1 11-6 11-12-7 1-11 5-11 12Z" fill="#e5c65b" />
        <path d="M32 45c-8-1-12-5-14-10 8-1 12 3 14 10ZM32 45c8-1 12-5 14-10-8-1-12 3-14 10Z" fill="#4f8a60" />
      </svg>
    </div>
  );
}

const STROKE = {
  className: "h-[17px] w-[17px]",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CheckMark() {
  return <svg {...STROKE}><path d="m6 12 4 4 8-9" /></svg>;
}

function ShieldMark() {
  return <svg {...STROKE}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function BoltMark() {
  return <svg {...STROKE}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>;
}

function HeadsetMark() {
  return <svg {...STROKE}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 14h3v5H5a1 1 0 0 1-1-1v-4Z" /><path d="M20 14h-3v5h2a1 1 0 0 0 1-1v-4Z" /></svg>;
}
