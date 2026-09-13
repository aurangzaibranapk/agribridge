import type { Metadata } from "next";
import { Beef, ClipboardCheck, Droplets, Thermometer, Truck, Wallet } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { ActionCard } from "@/components/site/action-card";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Dairy & Livestock | AgriBridge",
  description:
    "Doodh ki collection, quality ki jaanch, wanda aur jaanwar ki sehat — har litre ka record aur adaigi saaf.",
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
  return (
    <main>
      <PageHero
        eyebrow="AgriBridge Dairy"
        title="Har litre ka record —"
        highlight="aur har rupay ka hisaab."
        description="Doodh ki collection se adaigi tak. Rate quality ki asal jaanch par banta hai, aur kisan ko har collection ka apna record milta hai."
        primaryLabel="Hum se raabta"
        primaryHref="/contact"
        secondaryLabel="Kisan ki registration"
        secondaryHref="/register/farmer"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Dairy & Livestock"
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

      <WebsiteCta
        title="Apni dairy ka hisaab saaf karna chahte hain?"
        description="Collection, quality aur adaigi — teenon ek hi record par. Hum se baat karein."
        primaryLabel="Hum se raabta"
        primaryHref="/contact"
        secondaryLabel="Kisan services"
        secondaryHref="/kisan-services"
      />
    </main>
  );
}
