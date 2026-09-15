import type { Metadata } from "next";
import { EcosystemHome } from "@/components/site/ecosystem-home";
import { HeroSlider } from "@/components/site/hero-slider";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pakistan's Digital Agriculture Platform",
  description:
    "AgriBridge by Al Rana Traders connects farmers with agriculture inputs, machinery booking, grain markets, dairy services, farm products and Kisan AI in Pakistan.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AgriBridge | Pakistan's Digital Agriculture Platform",
    description:
      "A connected agriculture ecosystem for farmers, inputs, machinery, grain, dairy, farm products and digital guidance in Pakistan.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgriBridge | Pakistan's Digital Agriculture Platform",
    description:
      "Connecting farmers with agriculture services, markets, machinery and digital guidance in Pakistan.",
  },
};

export default async function HomePage() {
  const supabase = createClient();

  const { data: heroSlides } = await supabase
    .from("hero_slides")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

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
