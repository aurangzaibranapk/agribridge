import type { Metadata } from "next";
import {
  BarChart3,
  Boxes,
  Landmark,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { ActionCard } from "@/components/site/action-card";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "AgriBridge ERP | Al Rana Traders",
  description:
    "Kharid se bikri tak, stock se ledger tak — ek hi nizam. Agriculture ke karobar ke liye bana hua ERP.",
};

/**
 * ERP ka public safha.
 *
 * "ERP Demo" ka button `/contact` par jata hai -- spec ka STEP 9:
 * dedicated demo inquiry route abhi nahi hai, is liye maujood contact
 * form istemal hota hai. Naya form banane ka matlab hota ek aur jagah
 * jahan darkhwastein aayein aur koi na dekhe.
 */
const MODULES = [
  {
    title: "Kharid aur stock",
    description: "Supplier bill se maal ginne tak — stock ek hi jagah se badalta hai, haath se nahi.",
    href: "/contact",
    icon: Boxes,
  },
  {
    title: "POS aur bikri",
    description: "Counter par bikri, khata aur wapsi — har qatar ledger tak jati hai.",
    href: "/contact",
    icon: Receipt,
  },
  {
    title: "Ledger aur finance",
    description: "Double entry, Trial Balance, aur har khate ka apna goshwara.",
    href: "/contact",
    icon: Landmark,
  },
  {
    title: "Reports",
    description: "Nafa nuqsan, cash flow, kis se lena kis ko dena — asal adad par.",
    href: "/contact",
    icon: BarChart3,
  },
  {
    title: "Staff aur ijazat",
    description: "Har bande ko sirf apna kaam. Jis ne banaya wohi manzoor nahi karta.",
    href: "/contact",
    icon: Users,
  },
  {
    title: "Audit aur hifazat",
    description: "Har tabdeeli ka nishan. Post ho chuki entry mitai nahi jati — durustagi nayi entry se hoti hai.",
    href: "/contact",
    icon: ShieldCheck,
  },
];

const FLOW = [
  "Supplier bill",
  "Kharid",
  "Maal ginna",
  "Stock",
  "Rate",
  "POS bikri",
  "Khata",
  "Ledger",
];

export default function ErpPage() {
  return (
    <main>
      <PageHero
        eyebrow="AgriBridge ERP"
        title="Ek karobar,"
        highlight="ek hi hisaab."
        description="Kharid, stock, bikri, khata aur ledger — sab ek nizam mein. Agriculture ke karobar ke liye bana hua, general software se dhala hua nahi."
        primaryLabel="Demo ke liye raabta"
        primaryHref="/contact"
        secondaryLabel="Partner banein"
        secondaryHref="/partner"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Modules"
            title="Wo cheezein jo dukan par roz chalti hain"
            description="ERP ka faida tab hai jab counter par khara banda us se tez kaam kar sake. Har module usi soch par bana hai."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <ActionCard key={m.title} {...m} />
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="bg-[#f6f8f3] py-14 sm:py-20 dark:bg-surface-900">
        <SiteContainer>
          <SectionHeading
            eyebrow="Ek hi raasta"
            title="Supplier ke bill se ledger tak"
            description="Beech mein koi qadam chhoota nahi. Isi liye mahine ke aakhir mein adad jhagRte nahi."
          />
          <div className="mt-9">
            <EcosystemFlow steps={FLOW} />
          </div>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Apne karobar par chala kar dekhna chahte hain?"
        description="Demo ke liye raabta karein — aap ke karobar ke mutabiq dikhaya jayega."
        primaryLabel="Demo ke liye raabta"
        primaryHref="/contact"
        secondaryLabel="Partner / Business"
        secondaryHref="/partner"
      />
    </main>
  );
}
