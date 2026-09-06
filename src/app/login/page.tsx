import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";

export default function LoginPage() {
  const lang = getLanguageFromCookies("ur");
  const features = [
    ["Farmer Management", "One Farmer, One Profile", <FarmerMark key="farmer" />],
    ["Retail & Inventory", "POS, stock aur purchasing", <CartMark key="cart" />],
    ["Milk & Grain", "Collection se settlement tak", <CropMark key="crop" />],
    ["Machinery & Finance", "Booking, khata aur payments", <GearMark key="gear" />],
  ] as const;

  return (
    <LangProvider lang={lang}>
      <main className="h-[100dvh] overflow-hidden bg-[#f8f9f5] lg:grid lg:grid-cols-[51%_49%]">
        <section className="relative hidden h-[100dvh] min-h-0 overflow-hidden border-r border-[#dce6d9] bg-[#eef5e8] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-7 xl:px-16 xl:py-8">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(191,224,213,0.72),transparent_34%),radial-gradient(circle_at_68%_28%,rgba(255,248,208,0.86),transparent_36%),linear-gradient(180deg,#edf7ee_0%,#f6f6dc_52%,#dce9a7_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(180deg,rgba(84,128,48,0.02),rgba(49,105,42,0.16))]" />
            <svg className="absolute inset-x-0 bottom-0 h-[44%] w-full opacity-80" viewBox="0 0 900 420" preserveAspectRatio="xMidYMax slice" fill="none">
              <path d="M0 420V335c95-48 188-44 278-12 104 37 176-22 280-10 99 12 181 60 342 4v103H0Z" fill="#a9c86c" fillOpacity=".48" />
              <path d="M0 420V372c116-52 211-7 318-28 118-24 191-72 326-31 84 26 158 27 256-1v108H0Z" fill="#6f9d4e" fillOpacity=".48" />
              <g stroke="#4d813c" strokeWidth="5" strokeLinecap="round" opacity=".55">
                <path d="M84 420V244"/><path d="M84 296c-30-4-50-25-54-58 31 4 50 24 54 58Z"/><path d="M84 335c32-5 50-25 54-59-31 4-50 24-54 59Z"/>
                <path d="M784 420V224"/><path d="M784 283c-32-5-50-26-54-60 31 4 50 25 54 60Z"/><path d="M784 328c32-5 50-26 54-60-31 4-50 25-54 60Z"/>
              </g>
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <BrandMark />
              <div>
                <p className="font-display text-xl font-bold text-[#123d2a]">{t("au_company", lang)}</p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#4e7656]">{t("au_brand", lang)}</p>
              </div>
            </div>

            <div className="mt-8 max-w-[650px] xl:mt-10 [@media(max-height:820px)]:mt-5">
              <span className="inline-flex rounded-full border border-[#b9d4a8] bg-[#e9f2d5]/90 px-3 py-1.5 text-xs font-semibold text-[#245d39]">
                Intelligent Agriculture Business Platform
              </span>
              <h1 className="mt-4 max-w-[620px] font-display text-4xl font-bold leading-[1.06] tracking-tight text-[#0d442e] xl:text-[3rem] [@media(max-height:820px)]:text-[2.35rem]">
                Pakistan&apos;s Intelligent Agriculture Business Platform
              </h1>
              <p className="mt-3 max-w-xl text-base font-medium leading-6 text-[#215f40] xl:text-lg [@media(max-height:820px)]:text-sm">
                Farmer, Retail, Milk, Grain, Machinery aur Finance — sab ek jagah.
              </p>

              <div className="mt-5 grid max-w-[650px] grid-cols-2 gap-3 [@media(max-height:820px)]:mt-4">
                {features.map(([title, body, icon]) => (
                  <div key={title} className="flex min-h-[82px] items-center gap-4 rounded-2xl border border-white/80 bg-white/70 px-5 py-3.5 shadow-[0_12px_30px_-24px_rgba(21,75,43,0.5)] backdrop-blur-md [@media(max-height:820px)]:min-h-[70px] [@media(max-height:820px)]:py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[#277344]">{icon}</span>
                    <div>
                      <p className="text-sm font-bold text-[#153f2b]">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#4d6957] [@media(max-height:820px)]:leading-4">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 divide-x divide-white/20 rounded-2xl border border-[#b8d59c] bg-[#1f5a31]/90 px-4 py-3.5 text-white shadow-[0_8px_30px_-14px_rgba(26,78,39,0.7)] backdrop-blur-md [@media(max-height:820px)]:py-2.5">
            <TrustItem icon={<ShieldMark />} title="Secure & Verified" body="Your data is protected" />
            <TrustItem icon={<BoltMark />} title="Fast Access" body="Quick & easy login" />
            <TrustItem icon={<HeadsetMark />} title="Farmer Support" body="Always here to help" />
          </div>
        </section>

        <section className="relative flex h-[100dvh] min-h-0 items-center justify-center overflow-hidden bg-[#fbfcf8] px-4 py-3 sm:px-8 lg:px-12 lg:py-4">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#f0e6b5]/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#b8d8c2]/25 blur-3xl" />

          <div className="relative w-full max-w-[470px] origin-center transition-transform [@media(max-height:900px)]:scale-[0.94] [@media(max-height:800px)]:scale-[0.86] [@media(max-height:700px)]:scale-[0.76] [@media(max-height:620px)]:scale-[0.68]">
            <div className="mb-4 flex items-center justify-between lg:hidden [@media(max-height:700px)]:mb-2">
              <div className="flex items-center gap-3">
                <BrandMark compact />
                <div>
                  <p className="font-display text-base font-semibold text-[#123321]">{t("au_company", lang)}</p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#5c795f]">{t("au_brand", lang)}</p>
                </div>
              </div>
              <Link href="/" className="rounded-full border border-[#dfe5dc] bg-white px-3 py-2 text-xs font-semibold text-[#385442] shadow-sm">Website</Link>
            </div>

            <div className="mb-4 [@media(max-height:760px)]:mb-2">
              <p className="text-sm font-semibold text-[#2f6b45]">Welcome to AgriBridge</p>
              <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[#103b29] [@media(max-height:760px)]:text-2xl">Apna account kholain</h2>
              <p className="mt-1.5 text-sm leading-5 text-[#66766b] [@media(max-height:760px)]:text-xs">Farmer, customer, staff aur vendor — apna sahi login raasta chunain.</p>
            </div>

            <div className="rounded-[28px] border border-[#e1e6de] bg-white/95 p-5 shadow-[0_24px_70px_-30px_rgba(13,40,24,0.32)] sm:p-6 [@media(max-height:820px)]:p-4">
              <Suspense fallback={null}><LoginForm /></Suspense>
              <div className="mt-4 border-t border-[#e9ece7] pt-3 [@media(max-height:760px)]:mt-2 [@media(max-height:760px)]:pt-2">
                <div className="flex items-start gap-3 rounded-xl bg-[#f2f7f2] px-3.5 py-2.5">
                  <span className="mt-0.5 text-[#2f6b45]"><ShieldMark /></span>
                  <div>
                    <p className="text-xs font-semibold text-[#284a34]">Aapki maloomat mehfooz hai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#708076]">OTP, account aur business data secure access ke sath use hota hai.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 divide-x divide-[#cddacb] rounded-2xl border border-[#cfe3b9] bg-white/90 px-2 py-2.5 text-[#164a31] shadow-[0_8px_26px_-15px_rgba(55,109,53,0.7)] ring-1 ring-[#e5f0cf] [@media(max-height:760px)]:mt-2 [@media(max-height:760px)]:py-2">
              <FooterItem href="/" icon={<GlobeMark />} label="Website par wapas" />
              <FooterItem icon={<LockMark />} label="Safe & Secure" />
              <FooterItem icon={<HeadsetMark />} label="24/7 Support" />
            </div>
          </div>
        </section>
      </main>
    </LangProvider>
  );
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="flex min-w-0 items-center gap-3 px-4"><span className="text-[#d7f47a]">{icon}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{title}</p><p className="mt-0.5 truncate text-[11px] text-white/80">{body}</p></div></div>;
}

function FooterItem({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const content = <><span className="text-[#23643e]">{icon}</span><span className="font-semibold">{label}</span></>;
  const cls = "flex min-w-0 items-center justify-center gap-2 px-2 text-center text-[11px] sm:text-xs";
  return href ? <Link href={href} className={`${cls} hover:text-[#0d3d28]`}>{content}</Link> : <div className={cls}>{content}</div>;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-11 w-11" : "h-14 w-14";
  return <div className={`flex ${size} shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/35 bg-[#123d2a] shadow-lg`}><svg viewBox="0 0 64 64" className="h-9 w-9" fill="none"><path d="M32 5 54 17v25L32 55 10 42V17L32 5Z" stroke="#e5c65b" strokeWidth="2"/><path d="M32 45V20" stroke="#e5c65b" strokeWidth="2" strokeLinecap="round"/><path d="M32 28c-8-1-11-6-11-12 7 1 11 5 11 12ZM32 35c8-1 11-6 11-12-7 1-11 5-11 12Z" fill="#e5c65b"/><path d="M32 45c-8-1-12-5-14-10 8-1 12 3 14 10ZM32 45c8-1 12-5 14-10-8-1-12 3-14 10Z" fill="#6ea36f"/></svg></div>;
}

const STROKE = { className: "h-[19px] w-[19px]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function ShieldMark(){return <svg {...STROKE}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>}
function BoltMark(){return <svg {...STROKE}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>}
function HeadsetMark(){return <svg {...STROKE}><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v5H5a1 1 0 0 1-1-1v-4Z"/><path d="M20 14h-3v5h2a1 1 0 0 0 1-1v-4Z"/></svg>}
function GlobeMark(){return <svg {...STROKE}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9Z"/></svg>}
function LockMark(){return <svg {...STROKE}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>}
function FarmerMark(){return <svg {...STROKE} className="h-8 w-8"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>}
function CartMark(){return <svg {...STROKE} className="h-8 w-8"><path d="M3 4h2l2 11h10l3-7H7"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>}
function CropMark(){return <svg {...STROKE} className="h-8 w-8"><path d="M12 22V5M12 10c-4 0-6-2-7-5 4 0 6 2 7 5ZM12 15c4 0 6-2 7-5-4 0-6 2-7 5ZM12 20c-4 0-6-2-7-5 4 0 6 2 7 5Z"/></svg>}
function GearMark(){return <svg {...STROKE} className="h-8 w-8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>}
