import type { Metadata } from "next";
import { Bell, BookOpen, CreditCard, Droplets, FileText, PackageSearch, Sprout, Tractor, UserRound, Wallet, Wheat } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { SiteContainer } from "@/components/site/site-container";
import { EcosystemFlow } from "@/components/site/ecosystem-flow";
import { WebsiteCta } from "@/components/site/website-cta";

export const metadata: Metadata = {
  title: "Kisan Digital Services | ART AgriBridge",
  description:
    "Farmer profile, Kisan Khata, wallet, crop plan, machinery booking, milk aur grain records — ek kisan, ek juRa hua record.",
};

const FEATURES = [
  ["Kisan ka profile", UserRound, "Ek mobile, ek kisan — naam, zameen aur raabta ek jagah."],
  ["Kisan Khata", BookOpen, "Kya liya, kya diya, kitna baqi — har qatar likhi hui."],
  ["Wallet", Wallet, "Jama shuda raqam aur us ka poora hisaab."],
  ["Fasal ki planning", Sprout, "Kaunsi fasal, kitna raqba, kaunse inputs."],
  ["Credit / Udhaar", CreditCard, "Kisan ki hadd aur baqi raqam — saaf saaf."],
  ["Product ke order", PackageSearch, "Beej, khaad aur dawai ke order aur un ki haalat."],
  ["Machine ki booking", Tractor, "Raqba, tareekh aur bill — sab record par."],
  ["Doodh ka record", Droplets, "Roz ki collection, quality aur adaigi."],
  ["Anaj ka record", Wheat, "Wazan, rate aur adaigi ka poora hisaab."],
  ["Statement", FileText, "Har mahine ka hisaab, jab chahein."],
  ["Ittila", Bell, "Adaigi, booking aur order ki khabar."],
] as const;

const JOURNEY = ["Profile", "Zameen", "Fasal", "Kharid", "Machine", "Doodh / Anaj", "Adaigi", "Statement"];

export default function KisanServicesPage() {
  return (
    <main>
      <PageHero
        eyebrow="Kisan Digital Services"
        title="Aap ki kheti."
        highlight="Aap ka apna record."
        description="Kisan ka profile, khata, wallet, fasal, machine, doodh, anaj aur adaigi — sab ek juRi hui jagah par, taake koi cheez zubani na rahe."
        primaryLabel="Kisan login"
        primaryHref="/login"
        secondaryLabel="Naya account banayein"
        secondaryHref="/register/farmer"
      />

      <section className="bg-white py-14 sm:py-20 dark:bg-surface-950">
        <SiteContainer>
          <SectionHeading
            center
            eyebrow="Ek Kisan"
            title="Ek juRa hua safar"
            description="Alag alag registeron ki jagah kisan ki har service us ke apne profile se juRi hui — aur wohi record us ko bhi nazar aata hai."
          />
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map(([title, Icon, body]) => (
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

      <section className="border-y border-[#C9A227]/15 bg-[#0D2818] py-14 sm:py-20">
        <SiteContainer>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E8C767]">Kisan 360</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
            Profile se statement tak — ek hi lakeer
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
            Har qadam pichhle qadam se juRa hua hai. Isi liye kisi bhi waqt ye poochha ja sakta hai ke
            paisa kahan se aaya aur kahan gaya.
          </p>
          <div className="mt-8">
            <EcosystemFlow steps={JOURNEY} tone="dark" />
          </div>
        </SiteContainer>
      </section>

      <WebsiteCta
        title="Apna kisan record aaj shuru karein"
        description="Mobile number se login karein — OTP WhatsApp ya SMS par aata hai."
        primaryLabel="Kisan login"
        primaryHref="/login"
        secondaryLabel="Madad chahiye"
        secondaryHref="/contact"
      />
    </main>
  );
}
