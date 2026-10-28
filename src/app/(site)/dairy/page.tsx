import type { Metadata } from "next";
import { Beef, ClipboardCheck, Droplets, Thermometer, Truck, Wallet, Snowflake, BadgeCheck, Wallet2, Factory } from "lucide-react";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { ActionCard } from "@/components/site/action-card";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { Ur } from "@/components/site/dairy/urdu";
import { WhatsAppButton } from "@/components/site/dairy/whatsapp-button";
import { DairyProductCard } from "@/components/site/dairy/product-card";
import { DAIRY_FAQ, DAIRY_PRODUCTS, SITE_URL, SUPPLY, WHATSAPP_DISPLAY, faqJsonLd, productJsonLd } from "@/lib/dairy-public/offer";

const PAGE_URL = `${SITE_URL}/dairy`;

export const metadata: Metadata = {
  title: "Khalis Doodh 13 TS, Desi Ghee, Desi Anday | Al Rana Traders",
  description:
    "Kisanon se seedha 13 TS khalis doodh (Lahore Rs 200, Islamabad Rs 230 per litre), desi ghee Rs 4,000 per kg aur desi anday Rs 30. WhatsApp par order karein.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Khalis Doodh 13 TS, Desi Ghee, Desi Anday | Al Rana Traders",
    description: "Kisanon se seedha khalis doodh, desi ghee aur desi anday. WhatsApp par order karein.",
    url: PAGE_URL,
    locale: "ur_PK",
    type: "website",
  },
};

/**
 * Dairy ka darwaza.
 *
 * Doodh ka asal nizam ERP ke andar chalta hai (collection, quality,
 * dispatch, adaigi). Yahan koi naya form nahi banaya gaya -- spec ka
 * wohi usool jo machinery par laga tha: darwaza banao, doosra nizam
 * nahi.
 */
const SERVICES = [
  {
    title: "Doodh ki collection",
    description: "Subah aur shaam ki collection, har kisan ka apna record — litre aur rate ke sath.",
    href: "/contact",
    icon: Droplets,
  },
  {
    title: "Quality ki jaanch",
    description: "Fat aur SNF ki jaanch collection ke waqt — rate usi par banta hai, andaze par nahi.",
    href: "/contact",
    icon: Thermometer,
  },
  {
    title: "Wanda aur feed",
    description: "Cattle aur dairy feed — qism aur rate saamne.",
    href: "/products?category=wanda",
    icon: Beef,
  },
  {
    title: "Jaanwar ki sehat",
    description: "Veterinary medicines aur mashwara — waqt par ilaaj.",
    href: "/products?category=veterinary",
    icon: ClipboardCheck,
  },
  {
    title: "Dispatch aur supply",
    description: "Collection se aage — dairy aur khareedne walon tak.",
    href: "/contact",
    icon: Truck,
  },
  {
    title: "Adaigi aur khata",
    description: "Har collection ka hisaab, aur adaigi ka saaf record.",
    href: "/kisan-services",
    icon: Wallet,
  },
];

const FLOW = [
  "Kisan",
  "Subah/shaam collection",
  "Fat aur SNF",
  "Rate",
  "Chilling",
  "Dispatch",
  "Khata",
  "Adaigi",
];

export default function DairyPage() {
  const jsonLd = [
    ...productJsonLd(PAGE_URL),
    faqJsonLd(),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Dairy", item: PAGE_URL },
      ],
    },
  ];
  const highlights = [
    { icon: Factory, t: `Rozana ${SUPPLY.dailyLitresNow} litre`, u: "روزانہ 5,000 سے 6,000 لیٹر" },
    { icon: Snowflake, t: "Chill kar ke, thandi gaari mein", u: "ٹھنڈی گاڑی میں ڈیلیوری" },
    { icon: Wallet2, t: "Cash on delivery ya advance", u: "کیش آن ڈیلیوری یا ایڈوانس" },
    { icon: BadgeCheck, t: "Registered food business", u: "رجسٹرڈ کاروبار" },
  ];
  return (
    <main className="bg-[#faf7f0] dark:bg-[#0b1628]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="py-12 sm:py-16">
        <SiteContainer className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#a77a1f] dark:text-[#e0b45a]">Al Rana Traders Dairy</p>
            <h1 className="mt-2 text-3xl font-extrabold text-[#1d2a3a] sm:text-4xl dark:text-[#eef2f8]">Khalis Doodh 13 TS, Desi Ghee, Desi Anday</h1>
            <Ur as="div" className="mt-2 text-2xl font-bold text-[#1f6f4a] dark:text-[#4fc28a]">خالص دودھ، دیسی گھی، دیسی انڈے — کسان سے سیدھا آپ تک</Ur>
            <p className="mt-2 text-[#5b6675] dark:text-[#9fb0c8]">Kisan se seedha aap tak. Hum doodh apne kisanon se khud ikattha karte hain, darmiyan mein koi dodhi nahi.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <WhatsAppButton />
              <a href="/bulk-order" className="inline-flex items-center rounded-xl border border-[#1f6f4a] px-5 py-3 text-sm font-bold text-[#1f6f4a] dark:border-[#4fc28a] dark:text-[#4fc28a]">Bulk order · بڑا آرڈر</a>
            </div>
            <p className="mt-3 text-sm text-[#5b6675] dark:text-[#9fb0c8]">WhatsApp: {WHATSAPP_DISPLAY}</p>
          </div>
          <div className="rounded-2xl border border-[#e8e1d2] bg-white p-6 dark:border-[#22365a] dark:bg-[#13223b]">
            <h2 className="font-bold text-[#1d2a3a] dark:text-[#eef2f8]">Hamari kahani · Our story</h2>
            <Ur className="mt-2 text-[17px] text-[#3c4756] dark:text-[#c4d0e2]">ہم دودھ کسانوں سے خود جمع کرتے ہیں۔ درمیان میں کوئی دودھی یا آڑھتی نہیں، اس لیے کسان کو بھی پورا حق ملتا ہے۔</Ur>
            <p className="mt-2 text-sm text-[#5b6675] dark:text-[#9fb0c8]">Hum doodh kisanon se khud ikattha karte hain. Darmiyan mein koi dodhi ya aarhti nahi, is liye kisan ko bhi poora haq milta hai.</p>
          </div>
        </SiteContainer>
      </section>

      <section className="pb-12">
        <SiteContainer>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map(({ icon: Icon, t, u }) => (
              <div key={t} className="flex items-center gap-3 rounded-xl border border-[#e8e1d2] bg-white p-4 dark:border-[#22365a] dark:bg-[#13223b]">
                <Icon className="h-6 w-6 shrink-0 text-[#1f6f4a] dark:text-[#4fc28a]" aria-hidden />
                <div>
                  <div className="text-sm font-bold text-[#1d2a3a] dark:text-[#eef2f8]">{t}</div>
                  <Ur as="div" className="text-sm text-[#5b6675] dark:text-[#9fb0c8]">{u}</Ur>
                </div>
              </div>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="pb-14" aria-labelledby="products-h">
        <SiteContainer>
          <h2 id="products-h" className="text-2xl font-extrabold text-[#1d2a3a] dark:text-[#eef2f8]">Hamari cheezen · ہماری چیزیں</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {DAIRY_PRODUCTS.map((p) => (
              <DairyProductCard key={p.id} p={p} />
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="pb-14">
        <SiteContainer>
          <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#1f6f4a] to-[#1d3f6e] p-7 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-extrabold">Hotel, bakery, mithai shop, caterer, hostel</h2>
              <p className="mt-1 text-white/85">Rozana bulk supply. Lahore mein kam se kam {SUPPLY.lahoreMinimumLitres} litre.</p>
              <Ur className="text-white/90">ہوٹل، بیکری، مٹھائی کی دکان اور کیٹرنگ کے لیے روزانہ سپلائی</Ur>
            </div>
            <a href="/bulk-order" className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-[#1d3f6e]">Bulk order form</a>
          </div>
        </SiteContainer>
      </section>

      <section className="pb-14" aria-labelledby="faq-h">
        <SiteContainer>
          <h2 id="faq-h" className="text-2xl font-extrabold text-[#1d2a3a] dark:text-[#eef2f8]">Sawal o jawab · سوال و جواب</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {DAIRY_FAQ.map((f) => (
              <details key={f.qRoman} className="rounded-xl border border-[#e8e1d2] bg-white p-4 dark:border-[#22365a] dark:bg-[#13223b]">
                <summary className="cursor-pointer font-bold text-[#1d2a3a] dark:text-[#eef2f8]">{f.qRoman} · <Ur as="span">{f.qUrdu}</Ur></summary>
                <p className="mt-2 text-sm text-[#5b6675] dark:text-[#9fb0c8]">{f.aRoman}</p>
                <Ur className="text-[15px] text-[#3c4756] dark:text-[#c4d0e2]">{f.aUrdu}</Ur>
              </details>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Kisanon ke liye · Dairy & Livestock"
            title="Doodh, wanda aur jaanwar ki sehat — ek jagah"
            description="Collection ka nizam, feed ki supply aur veterinary — teenon ek hi platform se juRe hue."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <ActionCard key={s.title} {...s} />
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="bg-[#f6f8f3] py-14 sm:py-20 dark:bg-surface-900">
        <SiteContainer>
          <SectionHeading
            eyebrow="Collection ka safar"
            title="Baalti se adaigi tak"
            description="Har qadam par record banta hai — is liye mahine ke aakhir mein hisaab par bahes nahi hoti."
          />
          <div className="mt-9">
            <EcosystemFlow steps={FLOW} />
          </div>
        </SiteContainer>
      </section>

    </main>
  );
}
