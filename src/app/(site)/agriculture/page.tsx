import type { Metadata } from "next";
import { Bug, Droplets, FlaskConical, Leaf, Sprout, Tractor, WalletCards, Wheat } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { ActionCard } from "@/components/site/action-card";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Agriculture & Farmer Services | ART AgriBridge",
  description:
    "Crop planning, seed, fertilizer, crop protection, machinery, farmer credit aur produce procurement — AgriBridge ka connected agriculture ecosystem.",
};

const JOURNEY = [
  "Crop Selection", "Land Preparation", "Seed", "Fertilizer",
  "Crop Protection", "Irrigation", "Machinery", "Harvest",
];

/**
 * Har khana kisi ASAL jagah par jata hai.
 *
 * Spec ka usool: koi `href="#"`, koi mara hua button nahi. Is liye
 * yahan sirf wo raaste hain jo waqai maujood hain -- `/marketplace`,
 * `/machinery`, `/kisan-ai` waghera. Jis cheez ka safha nahi, us ka
 * card bhi nahi.
 */
const SERVICES = [
  { title: "Crop Planning", description: "Fasal ki planning aur mausam ke hisaab se tarteeb.", href: "/kisan-services", icon: Leaf },
  { title: "Seeds", description: "Tasdeeq shuda beej — qism aur waqt ke mutabiq.", href: "/marketplace", icon: Sprout },
  { title: "Fertilizer", description: "Khaad ki poori qismein, rate ke sath.", href: "/marketplace", icon: FlaskConical },
  { title: "Crop Protection", description: "Keeray aur bimari se bachao ki dawaiyan.", href: "/marketplace", icon: Bug },
  { title: "Irrigation & Water", description: "Paani aur zameen ki tayari ka mashwara.", href: "/kisan-ai", icon: Droplets },
  { title: "Machinery", description: "Harvester, tractor aur baqi machine ki booking.", href: "/machinery", icon: Tractor },
  { title: "Farmer Credit", description: "Kisan khata, wallet aur credit ki suhulat.", href: "/kisan-services", icon: WalletCards },
  { title: "Produce Procurement", description: "Gandum, chawal aur makai ki kharid.", href: "/grain", icon: Wheat },
];

const STEPS = [
  ["Kisan ka indraj", "Naam, mobile aur zameen — ek dafa."],
  ["Fasal ki planning", "Kaunsi fasal, kitna raqba, kaunsa mausam."],
  ["Inputs khareedein", "Beej, khaad aur dawai — rate saamne."],
  ["Mashwara lein", "Kisan AI se, ya hamare bande se."],
  ["Machine book karein", "Raqba aur tareekh ke mutabiq."],
  ["Fasal bechein", "Procurement ya marketplace ke zariye."],
  ["Hisaab dekhein", "Khata, adaigi aur statement — sab likha hua."],
];

export default function AgriculturePage() {
  return (
    <main>
      <PageHero
        eyebrow="Agriculture & Farmer Services"
        title="Smart Agriculture."
        highlight="Behtar Faisle."
        description="Fasal ki planning se le kar inputs, machinery, AI ke mashware aur fasal bechne tak — AgriBridge har qadam par sath hai, aur har qadam ka hisaab likha rehta hai."
        primaryLabel="Apni fasal ka safar shuru karein"
        primaryHref="/kisan-services"
        secondaryLabel="Kisan AI se poochein"
        secondaryHref="/kisan-ai"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Farmer Services"
            title="Fasal ke har marhale par"
            description="Planning aur inputs se le kar harvest aur bikri tak — sab ek hi jagah, aur har cheez apni asal jagah se juRi hui."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <ActionCard key={s.title} {...s} />
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="border-y border-[#C9A227]/15 bg-[#f6f8f3] py-14 sm:py-20 dark:border-surface-800 dark:bg-surface-900">
        <SiteContainer>
          <SectionHeading center eyebrow="Poora Safar" title="Beej se Bazaar tak" />
          <div className="mt-9">
            <EcosystemFlow steps={JOURNEY} />
          </div>
        </SiteContainer>
      </section>

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            eyebrow="Kaise kaam karta hai"
            title="AgriBridge kisan ki kaise madad karta hai"
          />
          <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li
                key={title}
                className="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900"
              >
                <span className="text-xs font-bold text-[#A9791A]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-surface-600 dark:text-surface-400">{body}</p>
              </li>
            ))}
          </ol>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Apni fasal ka safar aaj shuru karein"
        description="Kisan ka indraj, fasal ki planning aur inputs — sab ek hi jagah se."
        primaryLabel="Kisan Services dekhein"
        primaryHref="/kisan-services"
        secondaryLabel="Hum se raabta"
        secondaryHref="/contact"
      />
    </main>
  );
}
