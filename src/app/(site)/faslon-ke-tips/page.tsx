import type { Metadata } from "next";
import { SiteContainer } from "@/components/site/site-container";
import { SHOP_PHONE_WHATSAPP } from "@/lib/cms/website-setting";

export const metadata: Metadata = {
  title: "Faslon ke tips | AgriBridge",
  description: "Kisan bhaiyon ke liye muft rehnumai — gandum ki bijai, DAP, doodh, aur bimari ki pehchan. Kisan Pakistan.",
  alternates: { canonical: "/faslon-ke-tips" },
  openGraph: {
    title: "Faslon ke tips | AgriBridge",
    description: "Gandum, khaad, maweshi aur bimari — chhote mashware. Dose yahan nahi.",
    url: "/faslon-ke-tips",
  },
};

const TIPS = [
  {
    tag: "Gandum",
    title: "Bijai ka sahi waqt",
    body: "Nov se pehle 2 hafte. Beej qareeb 50 kg fi acre — apni zameen aur qism ke hisaab se apne centre se tasdeeq kar lein.",
  },
  {
    tag: "Khaad",
    title: "DAP kab dalein",
    body: "Bijai ke waqt, qareeb 1 bori fi acre. Zyada ya kam zameen ki report par. Yahan koi naya formula nahi.",
  },
  {
    tag: "Maweshi",
    title: "Doodh barhane ke tareeqe",
    body: "Saaf pani, wanda waqt par, aur dohna ek hi waqt par. Rate ke liye aaj wala safha dekhein.",
  },
  {
    tag: "Bimari",
    title: "Gandum ki kungi",
    body: "Peele dhabbe nazar aayein to tasveer Kisan AI par bhejein. Spray ka mashwara expert se lein — is safhe par dose nahi.",
  },
] as const;

export default function FaslonKeTipsPage() {
  const wa = `https://wa.me/${SHOP_PHONE_WHATSAPP}?text=${encodeURIComponent("Assalam o alaikum, fasal ke bare mein mashwara chahiye.")}`;
  return (
    <div className="bg-[#f4f7f2]">
      <SiteContainer className="py-10 sm:py-14">
        <p className="text-sm font-semibold text-emerald-800">Kisan Pakistan</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[#123629] sm:text-4xl">Faslon ke tips</h1>
        <p className="mt-2 max-w-2xl text-sm text-surface-600">Kisan bhaiyon ke liye muft rehnumai — Urdu, Roman, English</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TIPS.map((tip) => (
            <article key={tip.title} className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
              <p className="inline-flex rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold text-white">{tip.tag}</p>
              <h2 className="mt-3 font-display text-lg font-semibold text-[#123629]">{tip.title}</h2>
              <p className="mt-2 text-sm leading-6 text-surface-600">{tip.body}</p>
            </article>
          ))}
        </div>

        {/* Ad slot — baad mein, optional. Abhi koi ad network nahi, koi placeholder render nahi. */}

        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-[#123629] hover:bg-emerald-400"
        >
          Mazeed sawal? WhatsApp karein
        </a>
        <p className="mt-3 text-xs text-surface-500">
          Ye aam mashwara hai, kisi khet ki prescription nahi.{" "}
          <a href="/mahabali-doodh-gandum-rate" className="font-semibold text-emerald-800 hover:underline">Aaj ka doodh aur gandum rate</a>
          {" · "}
          <a href="/register/farmer" className="font-semibold text-emerald-800 hover:underline">Kisan register</a>
        </p>
      </SiteContainer>
    </div>
  );
}
