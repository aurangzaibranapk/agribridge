import type { Metadata } from "next";
import { CalendarDays, MapPin, Tractor } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Agricultural Machinery Booking | AgriBridge",
  description:
    "Harvester, tractor, cultivator aur baqi machine ki booking — raqba, tareekh aur rate saamne, aur poora bill record par.",
};

/**
 * Ye safha booking ka DARWAZA hai, booking ka nizam nahi.
 *
 * Machine ki asal booking `/book-machinery` par hoti hai aur wo pehle se
 * chal rahi hai. Spec ka usool: "Reuse existing machinery booking
 * engine. Do NOT create duplicate machinery booking tables/actions."
 * Is liye yahan sirf tafseel aur raasta hai -- ek bhi naya form nahi.
 */
const MACHINES = [
  "Rice Harvester", "Wheat Harvester", "Tractor", "Cultivator",
  "Rotavator", "Planter", "Sprayer", "Doosri machine",
];

const FLOW = ["Machine chunein", "Zameen", "Raqba", "Tareekh", "Booking", "Kaam", "Asal raqba", "Bill"];

export default function MachineryPage() {
  return (
    <main>
      <PageHero
        eyebrow="AgriBridge Machinery"
        title="Machine book karein —"
        highlight="itminaan ke sath."
        description="Raqba aur tareekh ke mutabiq machine ki booking. Kaam ke baad ASAL raqba naapa jata hai aur bill usi par banta hai — pehle se maan liya gaya raqba nahi."
        primaryLabel="Machine book karein"
        primaryHref="/book-machinery"
        secondaryLabel="Hum se raabta"
        secondaryHref="/contact"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Machinery Network"
            title="Sahi machine. Sahi khet. Sahi waqt."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MACHINES.map((machine) => (
              <div
                key={machine}
                className="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900"
              >
                <Tractor className="h-6 w-6 text-[#1E4A2E] dark:text-brand-400" />
                <h3 className="mt-4 font-display text-base font-semibold text-surface-900 dark:text-white">{machine}</h3>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-surface-500 dark:text-surface-400">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Booking</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Khet par</span>
                </div>
              </div>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="border-y border-[#C9A227]/15 bg-[#f6f8f3] py-14 sm:py-20 dark:border-surface-800 dark:bg-surface-900">
        <SiteContainer>
          <SectionHeading center eyebrow="Booking ka tareeqa" title="Machine chunne se bill tak" />
          <div className="mt-9">
            <EcosystemFlow steps={FLOW} />
          </div>
          <p className="mx-auto mt-7 max-w-2xl text-center text-sm leading-7 text-surface-600 dark:text-surface-400">
            Bill hamesha <strong className="text-surface-900 dark:text-white">asal raqbe</strong> par banta hai, jo kaam
            ke baad naapa jata hai. Is liye kisan ko pehle se andaza rehta hai aur baad mein jhagRa nahi hota.
          </p>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Machine ki zarurat hai?"
        description="Raqba aur tareekh batayein — baqi hum dekh lenge."
        primaryLabel="Booking ka form"
        primaryHref="/book-machinery"
        secondaryLabel="Hum se raabta"
        secondaryHref="/contact"
      />
    </main>
  );
}
