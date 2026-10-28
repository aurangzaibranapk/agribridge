import type { Metadata } from "next";
import { SiteContainer } from "@/components/site/site-container";
import { Ur } from "@/components/site/dairy/urdu";
import { GlassCheckout } from "@/components/site/dairy/glass-checkout";
import { DAIRY_PRODUCTS, SITE_URL, SUPPLY, WHATSAPP_DISPLAY, productJsonLd } from "@/lib/dairy-public/offer";

const PAGE_URL = `${SITE_URL}/bulk-order`;

export const metadata: Metadata = {
  title: "Bulk Doodh, Desi Ghee, Desi Anday Supply | Al Rana Traders",
  description:
    "Hotel, bakery, mithai shop aur caterers ke liye rozana 13 TS doodh ki bulk supply. Rozana 5,000-6,000 litre dastiyab. Form bharein, WhatsApp par bhejein.",
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Bulk Doodh Supply | Al Rana Traders", url: PAGE_URL, locale: "ur_PK", type: "website" },
};

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export default function BulkOrderPage() {
  const jsonLd = [
    ...productJsonLd(`${SITE_URL}/dairy`),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Dairy", item: `${SITE_URL}/dairy` },
        { "@type": "ListItem", position: 3, name: "Bulk order", item: PAGE_URL },
      ],
    },
  ];
  return (
    <main className="bg-[#faf7f0] py-12 sm:py-16 dark:bg-[#0b1628]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteContainer className="grid gap-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#a77a1f] dark:text-[#e0b45a]">Bulk order</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#1d2a3a] sm:text-4xl dark:text-[#eef2f8]">Karobar ke liye rozana supply</h1>
          <Ur as="div" className="mt-2 text-2xl font-bold text-[#1f6f4a] dark:text-[#4fc28a]">ہوٹل، بیکری، مٹھائی کی دکان اور کیٹرنگ کے لیے</Ur>
          <ul className="mt-5 space-y-2 text-[#3c4756] dark:text-[#c4d0e2]">
            <li>• Rozana {SUPPLY.dailyLitresNow} litre dastiyab, {SUPPLY.dailyLitresTarget} litre tak barh sakta hai</li>
            <li>• Desi ghee rozana {SUPPLY.gheeKgPerDay} kg tak, desi anday rozana {SUPPLY.eggsPerDay}</li>
            <li>• Lahore mein kam se kam {SUPPLY.lahoreMinimumLitres} litre</li>
            <li>• Chill kar ke thandi gaari mein delivery</li>
            <li>• Adaigi: cash on delivery ya advance</li>
            <li>• Registered food business</li>
          </ul>
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e8e1d2] bg-white dark:border-[#22365a] dark:bg-[#13223b]">
            <table className="w-full text-sm">
              <caption className="sr-only">Qeematein</caption>
              <tbody>
                {DAIRY_PRODUCTS.flatMap((p) =>
                  p.offers.map((o) => (
                    <tr key={p.id + o.city} className="border-b border-[#e8e1d2] last:border-0 dark:border-[#22365a]">
                      <td className="p-3 font-semibold text-[#1d2a3a] dark:text-[#eef2f8]">{p.nameRoman}{o.city !== "Pakistan" ? ` · ${o.city}` : ""}</td>
                      <td className="p-3 text-right font-extrabold text-[#1f6f4a] dark:text-[#4fc28a]">{rs(o.price)} <span className="text-xs font-semibold text-[#a77a1f] dark:text-[#e0b45a]">{o.unitText}</span></td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-[#5b6675] dark:text-[#9fb0c8]">WhatsApp: {WHATSAPP_DISPLAY}</p>
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[#1d2a3a] dark:text-[#eef2f8]">Order · آرڈر</h2>
          <Ur className="mb-4 text-[15px] text-[#5b6675] dark:text-[#9fb0c8]">مقدار چنیں، واٹس ایپ کھلے گا، پھر آپ خود بھیجیں۔</Ur>
          <GlassCheckout />
        </div>
      </SiteContainer>
    </main>
  );
}
