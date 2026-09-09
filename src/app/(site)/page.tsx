import { EcosystemHome } from "@/components/site/ecosystem-home";
import { HeroSlider } from "@/components/site/hero-slider";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
