import type { Metadata } from "next";
import { Banknote, FileText, Scale, ShieldCheck, Truck, Wheat } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Grain & Produce Procurement | ART AgriBridge",
  description:
    "Gandum, chawal aur makai ki kharid — shaffaf wazan, shaffaf rate aur shaffaf adaigi. Kisan ki fasal ka poora record.",
};

const FLOW = ["Kisan", "Fasal ki peshkash", "Wazan", "Quality", "Rate", "Kharid", "Adaigi", "Statement"];

const SERVICES = [
  ["Anaj ki kharid", Wheat, "Gandum, chawal, makai aur doosri fasal."],
  ["Wazan aur quality", Scale, "Kaanta aur naap — dono ka indraj."],
  ["Kisan ki adaigi", Banknote, "Kitna bana, kitna mila, kitna baqi."],
  ["Transport", Truck, "Khet se godam tak."],
  ["Statement", FileText, "Har kisan ka apna hisaab."],
  ["Shaffaf record", ShieldCheck, "Har qatar likhi hui, badalne par nishan."],
] as const;

export default function GrainPage() {
  return (
    <main>
      <PageHero
        eyebrow="Grain & Produce"
        title="Khet ke darwaze se"
        highlight="bazaar tak."
        description="Fasal ka wazan, us ki quality, rate aur adaigi — chaaron cheezein likhi jati hain aur kisan ko nazar aati hain. Zubani hisaab nahi."
        primaryLabel="Apni fasal bechein"
        primaryHref="/contact"
        secondaryLabel="Procurement se raabta"
        secondaryHref="/contact"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Produce Procurement"
            title="Shaffaf wazan. Shaffaf rate. Shaffaf adaigi."
            description="Kisan ka sab se bara sawal yehi hota hai — kitna wazan bana aur kitne ka bana. Dono jawab likhe hue hain, aur kabhi bhi dekhe ja sakte hain."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(([title, Icon, body]) => (
              <div
                key={title}
                className="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E4A2E]/[0.07] text-[#1E4A2E] dark:bg-brand-900/30 dark:text-brand-400">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-surface-600 dark:text-surface-400">{body}</p>
              </div>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="border-y border-[#C9A227]/15 bg-[#f6f8f3] py-14 sm:py-20 dark:border-surface-800 dark:bg-surface-900">
        <SiteContainer>
          <SectionHeading center eyebrow="Bechne ka tareeqa" title="Peshkash se adaigi tak" />
          <div className="mt-9">
            <EcosystemFlow steps={FLOW} />
          </div>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Fasal taiyar hai?"
        description="Hum se raabta karein — wazan, rate aur adaigi ka poora hisaab pehle se tay hoga."
        primaryLabel="Hum se raabta"
        primaryHref="/contact"
        secondaryLabel="Marketplace dekhein"
        secondaryHref="/marketplace"
      />
    </main>
  );
}
