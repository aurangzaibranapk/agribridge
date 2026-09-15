import type { Metadata } from "next";
import { Bug, Camera, MessageCircle, ScrollText, Sprout, Stethoscope } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { ActionCard } from "@/components/site/action-card";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Kisan AI | AgriBridge",
  description:
    "Fasal ki tasveer se bimari ki pehchan, mashwara aur ilaaj ka plan — Kisan AI, AgriBridge ka apna AI.",
};

/**
 * Kisan AI ka darwaza -- Crop Doctor ki JAGAH nahi.
 *
 * `/ai-crop-doctor` pehle se chal raha hai aur us ko haath nahi lagaya
 * gaya. Spec ka usool: "Reuse existing AI systems. Do NOT create a
 * duplicate AI backend." Ye safha sirf us tak pahunchne ka saaf raasta
 * hai.
 */
const TOOLS = [
  {
    title: "AI Crop Doctor",
    description: "Patte ki tasveer bhejein — bimari ki pehchan aur ilaaj ka plan.",
    href: "/ai-crop-doctor",
    icon: Stethoscope,
  },
  {
    title: "Keeray aur bimari",
    description: "Kaun sa keera hai, kab lagta hai, aur kis dawai se rukta hai.",
    href: "/ai-crop-doctor",
    icon: Bug,
  },
  {
    title: "Fasal ka mashwara",
    description: "Beej, khaad aur paani — mausam aur zameen ke mutabiq.",
    href: "/kisan-services",
    icon: Sprout,
  },
  {
    title: "WhatsApp par jawab",
    description: "Sawal WhatsApp par bhejein — jawab wahin milta hai.",
    href: "/contact",
    icon: MessageCircle,
  },
  {
    title: "Ilaaj ka plan",
    description: "Sirf naam nahi — matra, waqt aur tarteeb ke sath poora plan.",
    href: "/ai-crop-doctor",
    icon: ScrollText,
  },
  {
    title: "Dawai ka intezam",
    description: "Jo dawai batayi gayi, wo Marketplace se mangwayein.",
    href: "/marketplace",
    icon: Camera,
  },
];

const FLOW = [
  "Tasveer",
  "AI jaanch",
  "Bimari ki pehchan",
  "Ilaaj ka plan",
  "Dawai",
  "Order",
  "Khet par amal",
  "Nateeja",
];

export default function KisanAiPage() {
  return (
    <main>
      <PageHero
        eyebrow="Kisan AI"
        title="Fasal ki tasveer bhejein —"
        highlight="jawab foran."
        description="Patte ki ek tasveer se bimari ki pehchan, aur us ka poora ilaaj ka plan. Kisan ke liye — bilkul muft."
        primaryLabel="Crop Doctor kholein"
        primaryHref="/ai-crop-doctor"
        secondaryLabel="Kisan services"
        secondaryHref="/kisan-services"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="AI Tools"
            title="Wo mashwara jo waqt par mile"
            description="Kheti ka faisla der se hone par mehnga parta hai. Kisan AI ka maqsad yehi hai ke jawab usi waqt mile jab sawal paida ho."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <ActionCard key={t.title} {...t} />
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="bg-[#0c2d22] py-14 text-white sm:py-20">
        <SiteContainer>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E8C767]">Kaise chalta hai</p>
          <h2 className="mt-2 max-w-3xl text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Tasveer se nateeje tak — aath qadam
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/70">
            AI faisla nahi sunata — mashwara deta hai. Aakhri faisla hamesha kisan ka hota hai, aur us ke
            liye har qadam saaf likha jata hai.
          </p>
          <div className="mt-9">
            <EcosystemFlow steps={FLOW} tone="dark" />
          </div>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Fasal par kuch nazar aa raha hai?"
        description="Ek tasveer bhejein. Pehchan aur ilaaj ka plan foran milega — kisan ke liye muft."
        primaryLabel="Crop Doctor kholein"
        primaryHref="/ai-crop-doctor"
        secondaryLabel="Hum se raabta"
        secondaryHref="/contact"
      />
    </main>
  );
}
