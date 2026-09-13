import type { Metadata } from "next";
import { Building2, Handshake, Package, Sprout, Store, TrendingUp } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { ActionCard } from "@/components/site/action-card";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Partner & Business | AgriBridge",
  description:
    "Dealer, company, investor ya franchise — AgriBridge ke saath kaam karne ke raaste.",
};

/**
 * Partner ka safha.
 *
 * Har raasta `/invest` par jata hai, jahan pehle se investor inquiry ka
 * form aur chat widget maujood hai. Naya form NAHI banaya gaya -- warna
 * darkhwastein do jagah aatin aur ek jagah koi na dekhta.
 */
const MODELS = [
  {
    title: "Dealer banein",
    description: "Apne ilaqe mein AgriBridge ke products aur services — apni dukan se.",
    href: "/invest",
    icon: Store,
  },
  {
    title: "Company / supplier",
    description: "Apne products AgriBridge ke network par — kisan tak seedha raasta.",
    href: "/invest",
    icon: Building2,
  },
  {
    title: "Product investment",
    description: "Kisi ek product ya category mein sarmaya — aur us ka apna hisaab.",
    href: "/invest",
    icon: Package,
  },
  {
    title: "Dairy aur livestock",
    description: "Doodh aur jaanwar ke karobar mein hissa daari.",
    href: "/invest",
    icon: Sprout,
  },
  {
    title: "Franchise",
    description: "AgriBridge ka apna franchise — poore nizam ke sath.",
    href: "/invest",
    icon: TrendingUp,
  },
  {
    title: "Corporation deal",
    description: "BaRe idaron ke sath lambi muddat ka intezam.",
    href: "/invest",
    icon: Handshake,
  },
];

const FLOW = [
  "Raabta",
  "Baat cheet",
  "Model chunna",
  "Kaghazat",
  "Muahida",
  "Shuruaat",
  "Hisaab",
  "Hissa",
];

export default function PartnerPage() {
  return (
    <main>
      <PageHero
        eyebrow="Partner & Business"
        title="AgriBridge ke saath"
        highlight="kaam karein."
        description="Dealer, company, investor ya franchise — har raaste ka apna model hai, aur har model ka apna saaf hisaab."
        primaryLabel="Models dekhein"
        primaryHref="/invest"
        secondaryLabel="Hum se raabta"
        secondaryHref="/contact"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Partnership Models"
            title="Chhe raaste, ek hi usool"
            description="Hissa daari ka matlab hai ke hisaab dono taraf se nazar aaye. Har model ka apna record aur apni report hoti hai."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODELS.map((m) => (
              <ActionCard key={m.title} {...m} />
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="bg-[#f6f8f3] py-14 sm:py-20 dark:bg-surface-900">
        <SiteContainer>
          <SectionHeading
            eyebrow="Aage ka raasta"
            title="Pehli baat se hisse tak"
            description="Koi qadam chhupa hua nahi. Har marhale par aap ko maloom hota hai ke ab kya hoga."
          />
          <div className="mt-9">
            <EcosystemFlow steps={FLOW} />
          </div>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Baat shuru karein"
        description="Apna model chunein ya sirf sawal poochein — dono ka jawab milta hai."
        primaryLabel="Models dekhein"
        primaryHref="/invest"
        secondaryLabel="Hum se raabta"
        secondaryHref="/contact"
      />
    </main>
  );
}
