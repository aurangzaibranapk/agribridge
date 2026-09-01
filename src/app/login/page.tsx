import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";

/**
 * LangProvider yahan lagta hai, root layout par nahi. Root layout
 * poori website ka hai; wahan cookies() parhne se har safha dynamic ho
 * jata aur public website ka static rendering khatam ho jata. Login ke
 * safhe khud dynamic hain, is liye qeemat sirf yahin ada hoti hai.
 *
 * Is ke baghair andar wala form useLang() se hamesha default zaban leta
 * -- safha tarjuma shuda lagta, magar Urdu chunne wale bande ko phir
 * bhi Roman milta.
 */
export default function LoginPage() {
  const lang = getLanguageFromCookies("ur");
  return (
    <LangProvider lang={lang}>
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0D2818] px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#C9A227]/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-[#1E4A2E]/40 blur-3xl" />
      </div>

      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full opacity-[0.09] sm:h-72"
        viewBox="0 0 1200 300"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        <path d="M0 220 L60 160 L130 210 L200 140 L280 205 L350 150 L420 215 L500 170 L1200 170 L1200 300 L0 300 Z" fill="#C9A227" opacity="0.5" />

        <g fill="#C9A227">
          <rect x="20" y="215" width="220" height="65" />
          {[...Array(8)].map((_, i) => (
            <rect key={i} x={20 + i * 30} y="200" width="16" height="15" />
          ))}
          <rect x="60" y="180" width="30" height="100" />
          <rect x="55" y="165" width="40" height="18" />
        </g>

        <g fill="#C9A227">
          <rect x="470" y="230" width="260" height="50" />
          <path d="M540 230 Q540 175 600 175 Q660 175 660 230 Z" />
          <circle cx="600" cy="168" r="6" />
          <rect x="596" y="150" width="8" height="20" />
          <rect x="478" y="150" width="16" height="130" />
          <path d="M478 150 Q486 132 494 150 Z" />
          <circle cx="486" cy="126" r="4" />
          <rect x="706" y="150" width="16" height="130" />
          <path d="M706 150 Q714 132 722 150 Z" />
          <circle cx="714" cy="126" r="4" />
          <path d="M580 280 Q580 250 600 250 Q620 250 620 280 Z" fill="#0D2818" opacity="0.4" />
        </g>

        <g fill="#C9A227">
          <rect x="860" y="60" width="14" height="220" />
          <ellipse cx="867" cy="150" rx="34" ry="16" />
          <ellipse cx="867" cy="112" rx="20" ry="10" />
          <path d="M857 60 Q867 30 877 60 Z" />
        </g>

        <g>
          <path d="M980 280 Q980 195 1050 195 Q1120 195 1120 280 Z" fill="#C9A227" opacity="0.35" />
          <path d="M1000 280 Q1000 220 1050 220 Q1100 220 1100 280 Z" fill="#0D2818" />
          {[1015, 1030, 1050, 1070, 1085].map((x, i) => (
            <path key={i} d={`M${x} 235 Q${x - 4} 255 ${x} 280`} stroke="#C9A227" strokeWidth="2.5" fill="none" opacity="0.7" />
          ))}
        </g>

        <path d="M0 280 Q150 255 300 280 T600 280 T900 275 T1200 280 L1200 300 L0 300 Z" fill="#C9A227" opacity="0.6" />
      </svg>

      <div className="relative flex w-full max-w-sm flex-col items-stretch lg:max-w-4xl lg:flex-row lg:items-start lg:justify-center lg:gap-8">
        <div className="w-full lg:max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4">
            <svg width="72" height="80" viewBox="0 0 220 260" className="mx-auto">
              <defs>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F3D98B" />
                  <stop offset="50%" stopColor="#C9A227" />
                  <stop offset="100%" stopColor="#E8C767" />
                </linearGradient>
              </defs>
              <polygon points="110,10 190,55 190,145 110,190 30,145 30,55" fill="none" stroke="url(#goldGrad)" strokeWidth="2.5" />
              <polygon points="110,22 178,60 178,140 110,178 42,140 42,60" fill="#123321" stroke="url(#goldGrad)" strokeWidth="1" />
              <g transform="translate(110,60)">
                <path d="M0 90 L0 20" stroke="url(#goldGrad)" strokeWidth="2.5" strokeLinecap="round" />
                <g fill="url(#goldGrad)">
                  <ellipse cx="-9" cy="65" rx="6" ry="10" transform="rotate(-32 -9 65)" />
                  <ellipse cx="9" cy="65" rx="6" ry="10" transform="rotate(32 9 65)" />
                  <ellipse cx="-10" cy="46" rx="5.6" ry="9.4" transform="rotate(-30 -10 46)" />
                  <ellipse cx="10" cy="46" rx="5.6" ry="9.4" transform="rotate(30 10 46)" />
                  <ellipse cx="-9" cy="28" rx="5" ry="8.6" transform="rotate(-28 -9 28)" />
                  <ellipse cx="9" cy="28" rx="5" ry="8.6" transform="rotate(28 9 28)" />
                </g>
                <ellipse cx="0" cy="10" rx="4.6" ry="8.6" fill="url(#goldGrad)" />
                <path d="M0 90 Q-24 84 -28 66 Q-10 66 0 78 Z" fill="#4A7856" />
                <path d="M0 90 Q24 84 28 66 Q10 66 0 78 Z" fill="#4A7856" />
              </g>
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">{t("au_company", lang)}</h1>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.3em] text-[#E8C767]">{t("au_brand", lang)}</p>
          <p className="mt-2 text-sm text-[#9FB8A4]">{t("au_sign_in_title", lang)}</p>
        </div>

        <div className="relative rounded-2xl border border-white/5 bg-[#FCFAF5] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] sm:p-7">
          {/* Band karne ka nishan.
              Login ho jaye to ye khud hat jata hai -- kyunke tab safha
              hi badal jata hai. Aur agar banda login nahi karna chahta
              to usay yahan phansa nahi rehna chahiye: ek nishan par
              haath rakhe aur website par wapas. Pehle ye kaam neeche
              likhe ek chhote jumle se hota tha jise koi dekhta hi
              nahi tha. */}
          <Link
            href="/"
            aria-label={t("au_close_back_site", lang)}
            title={t("au_close", lang)}
            className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white text-[#4A5A4D] shadow-lg transition-colors hover:bg-[#0D2818] hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </Link>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          {/* Purana link "Naye farmer hain? Yahan register karein"
              hata diya gaya. Wo email aur password wale safhe par le
              jata tha -- ek aisi cheez maangne jo kisan ke paas hai hi
              nahi. Ab naye kisan ka raasta wohi hai jo purane ka hai:
              Kisan wale khane mein apna number likhein, OTP aaye, aur
              khata usi waqt ban jaye (197). */}
          <p className="mt-5 text-center text-xs leading-relaxed text-[#6B7B6E]">{t("au_new_farmer_above", lang)}<span className="font-medium text-[#1E4A2E]">{t("au_farmer_customer", lang)}</span> chun kar apna
            mobile number likhein — khata khud ban jayega.
          </p>
        </div>
        </div>

        {/* Teen baatein jo banda code ka intezar karte waqt sochta hai:
            aayega kahan se, na aaya to kya karun, aur mera number kis ke
            paas ja raha hai. Ye card un ka jawab pehle hi de deta hai --
            warna banda pehle rukta hai, phir phone karta hai.

            Chhoti screen par ye form ke NEECHE aata hai, uper nahi:
            mobile par pehli cheez wohi honi chahiye jo bharni hai. */}
        <aside className="mt-6 w-full rounded-2xl border border-white/10 bg-[#12301F]/80 p-5 backdrop-blur-sm lg:mt-24 lg:max-w-xs">
          <ul className="space-y-4">
            {[
              { icon: <ChatMark />, title: t("au_tip_channel_title", lang), body: t("au_tip_channel_body", lang) },
              { icon: <RefreshMark />, title: t("au_tip_resend_title", lang), body: t("au_tip_resend_body", lang) },
              { icon: <ShieldMark />, title: t("au_tip_safe_title", lang), body: t("au_tip_safe_body", lang) },
            ].map((tip) => (
              <li key={tip.title} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-[#7FD19A]">{tip.icon}</span>
                <span>
                  <span className="block text-[13px] font-semibold text-white">{tip.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[#9FB8A4]">{tip.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Neeche ki patti. Ye bechne wali baat nahi hai -- ye us bande ke
          liye hai jo pehli dafa apna number kisi website par likh raha
          hai aur jhijak raha hai. */}
      <div className="relative mt-10 w-full max-w-4xl border-t border-white/10 pt-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-center sm:grid-cols-4 sm:text-left">
          {[
            { icon: <ShieldMark />, title: t("au_foot_safe", lang), sub: t("au_foot_safe_sub", lang) },
            { icon: <BoltMark />, title: t("au_foot_fast", lang), sub: t("au_foot_fast_sub", lang) },
            { icon: <WheatMark />, title: t("au_foot_farmer", lang), sub: t("au_foot_farmer_sub", lang) },
            { icon: <HeadsetMark />, title: t("au_foot_support", lang), sub: t("au_foot_support_sub", lang) },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-1.5 sm:flex-row sm:items-start sm:gap-2.5">
              <span className="mt-0.5 shrink-0 text-[#C9A227]">{f.icon}</span>
              <span>
                <span className="block text-[13px] font-semibold text-white">{f.title}</span>
                <span className="block text-[11px] text-[#9FB8A4]">{f.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </LangProvider>
  );
}

/* ---- Patti aur card ke nishan. Sab yahin likhe hain: chhoti shaklon
   ke liye poori library mangwana safhe ko bhaari kar deta hai, aur ye
   safha wo pehla safha hai jo har bande ko load hota hai. ---- */

const STROKE = {
  className: "h-[18px] w-[18px]",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ChatMark() {
  return (
    <svg {...STROKE}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.7-5a8.4 8.4 0 0 1-.7-3.4 8.4 8.4 0 0 1 9-8.5 8.4 8.4 0 0 1 8 7.4Z" />
    </svg>
  );
}

function RefreshMark() {
  return (
    <svg {...STROKE}>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ShieldMark() {
  return (
    <svg {...STROKE}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BoltMark() {
  return (
    <svg {...STROKE}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

function WheatMark() {
  return (
    <svg {...STROKE}>
      <path d="M12 22V9" />
      <path d="M12 13c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4Z" />
      <path d="M12 13c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4Z" />
      <path d="M12 8c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4Z" />
      <path d="M12 8c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4Z" />
    </svg>
  );
}

function HeadsetMark() {
  return (
    <svg {...STROKE}>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h3v5H5a1 1 0 0 1-1-1v-4Z" />
      <path d="M20 14h-3v5h2a1 1 0 0 0 1-1v-4Z" />
      <path d="M17 19a3 3 0 0 1-3 3h-2" />
    </svg>
  );
}
