import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { SiteContainer } from "@/components/site/site-container";
import { SHOP_PHONE_DISPLAY, SHOP_PHONE_WHATSAPP } from "@/lib/cms/website-setting";
import { loadPublicRates } from "@/lib/public/load-today-rates";
import { formatPktDate, type PresentedRate, type RateDelta } from "@/lib/public/today-rates";
import { rsPlain } from "@/lib/reports/sales-analytics";

export const dynamic = "force-dynamic";

const urdu = localFont({
  src: "../../login/fonts/noto-nastaliq-urdu.woff2",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});

export const metadata: Metadata = {
  title: "Mahabali doodh aur gandum rate aaj | AgriBridge",
  description: "Mahabali MCC par doodh ka litre rate aur gandum ka 40kg rate. Sirf wohi number jo record mein ho. Khali ho to safha kehta hai rate abhi nahi.",
  alternates: { canonical: "/mahabali-doodh-gandum-rate" },
  openGraph: {
    title: "Mahabali doodh aur gandum rate aaj",
    description: "Kisan Pakistan. Aaj ka doodh aur gandum, jab record mein ho.",
    url: "/mahabali-doodh-gandum-rate",
  },
};

export default async function MahabaliRatePage() {
  const rates = await loadPublicRates();
  const wa = `https://wa.me/${SHOP_PHONE_WHATSAPP}?text=${encodeURIComponent("Assalam o alaikum, Mahabali doodh aur gandum ka aaj ka rate chahiye.")}`;
  const jsonLd = rateJsonLd(rates.milk, rates.wheat);

  return (
    <div className={`bg-[#f4f7f2] ${urdu.variable}`}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <SiteContainer className="max-w-3xl py-10 sm:py-14">
        <p className="text-sm font-semibold text-emerald-800">AgriBridge</p>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-[#123629] sm:text-4xl">
          Mahabali doodh &amp; gandum rate aaj
        </h1>
        <p className="mt-1 text-sm text-surface-500">{formatPktDate(rates.today)} · roz update jab record aaye</p>
        <p dir="rtl" className="mt-3 text-right font-urdu text-lg text-[#123629]">آج کا دودھ اور گندم ریٹ</p>

        {rates.note && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{rates.note}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <RateCard title="Doodh / litre" rate={rates.milk} />
          <RateCard title="Gandum / 40kg" rate={rates.wheat} />
        </div>

        <p className="mt-4 text-sm text-surface-700">{deltaLine(rates.milk, rates.wheat)}</p>

        <div className="mt-6 flex flex-col gap-3">
          <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-[#123629] hover:bg-emerald-400">
            WhatsApp pe roz rate paayein
          </a>
          <Link href="/register/farmer" className="rounded-xl bg-emerald-300 px-4 py-3 text-center text-sm font-semibold text-[#123629] hover:bg-emerald-200">
            Kisan Register karein
          </Link>
        </div>

        <p className="mt-6 text-xs leading-5 text-surface-500">
          Mahabali MCC · doodh collection · Kisan Pakistan. WhatsApp {SHOP_PHONE_DISPLAY}. Rate tabhi jab aaj ki collection ya kharid darj ho. Purani tareekh ko aaj nahi likha jata.
        </p>
      </SiteContainer>
    </div>
  );
}

function RateCard({ title, rate }: { title: string; rate: PresentedRate }) {
  const missing = rate.amount == null;
  const stale = !missing && !rate.isToday;
  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm text-surface-500">{title}</p>
      {missing && <p className="mt-2 font-display text-2xl font-semibold text-surface-700">abhi rate nahi</p>}
      {!missing && stale && (
        <>
          <p className="mt-2 text-sm font-semibold text-amber-800">Aaj ka rate abhi darj nahi</p>
          <p className="mt-1 font-display text-2xl font-semibold text-[#123629]">{rsPlain(rate.amount!)}</p>
          <p className="text-xs text-surface-500">Aakhri darj · {rate.asOf ? formatPktDate(rate.asOf) : ""}</p>
        </>
      )}
      {!missing && rate.isToday && <p className="mt-2 font-display text-3xl font-semibold text-[#123629]">{rsPlain(rate.amount!)}</p>}
      {rate.source && !missing && <p className="mt-1 text-[11px] text-surface-500">{rate.source}</p>}
    </div>
  );
}

function oneDelta(label: string, rate: PresentedRate): string | null {
  if (!rate.isToday || rate.amount == null) return null;
  return `${label} ${deltaWords(rate.delta)}`;
}

function deltaWords(delta: RateDelta): string {
  if (delta.kind === "same") return "same";
  if (delta.kind === "up" && delta.diff != null) return `▲ ${rsPlain(delta.diff)}`;
  if (delta.kind === "down" && delta.diff != null) return `▼ ${rsPlain(delta.diff)}`;
  return "kal ka muqabla nahi";
}

function deltaLine(milk: PresentedRate, wheat: PresentedRate): string {
  const parts = [oneDelta("Doodh", milk), oneDelta("Gandum", wheat)].filter(Boolean);
  if (parts.length === 0) return "Kal se farq tab dikhta hai jab aaj aur kal dono ka rate record mein ho.";
  return `Kal se farq · ${parts.join(" · ")}`;
}

function rateJsonLd(milk: PresentedRate, wheat: PresentedRate) {
  const offers = [
    milk.isToday && milk.amount != null ? { "@type": "Offer", name: "Doodh per litre", price: milk.amount, priceCurrency: "PKR" } : null,
    wheat.isToday && wheat.amount != null ? { "@type": "Offer", name: "Gandum per 40kg", price: wheat.amount, priceCurrency: "PKR" } : null,
  ].filter(Boolean);
  if (offers.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Mahabali doodh aur gandum rate",
    brand: "AgriBridge",
    offers,
  };
}
