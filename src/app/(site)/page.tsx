import type { Metadata } from "next";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { EcosystemHome } from "@/components/site/ecosystem-home";
import { HeroSlider } from "@/components/site/hero-slider";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: BRAND_TAGLINE.en,
  description:
    `${BRAND_NAME} — ${BRAND_TAGLINE.en}. Connects farmers with agriculture inputs, machinery booking, grain markets, dairy services, farm products and Kisan AI in Pakistan.`,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${BRAND_NAME} | ${BRAND_TAGLINE.en}`,
    description:
      `${BRAND_NAME} — ${BRAND_TAGLINE.en}. A connected agriculture ecosystem for farmers, inputs, machinery, grain, dairy, farm products and digital guidance in Pakistan.`,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | ${BRAND_TAGLINE.en}`,
    description:
      `${BRAND_NAME} — ${BRAND_TAGLINE.en}. Connecting farmers with agriculture services, markets, machinery and digital guidance in Pakistan.`,
  },
};

export default async function HomePage() {
  const heroSlides = await loadHeroSlides().catch(() => null);

  return (
    <>
      {heroSlides && heroSlides.length > 0 ? (
        <HeroSlider slides={heroSlides} />
      ) : null}

      <div className={heroSlides && heroSlides.length > 0 ? "[&>div>section:first-child]:hidden" : ""}>
        <EcosystemHome />
      </div>
    </>
  );
}

async function loadHeroSlides() {
  const supabase = createClient();
  const { data } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  return data;
}
