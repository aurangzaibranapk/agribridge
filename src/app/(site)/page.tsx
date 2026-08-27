import Link from "next/link";
import {
  Stethoscope, Package, ArrowRight, ShieldCheck,
  Handshake, TrendingUp, Sprout, Building2, Quote, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { HeroSlider } from "@/components/site/hero-slider";
import { NewsletterForm } from "@/components/site/newsletter-form";

const CATEGORY_FALLBACK = [
  { name: "Fertilizers", icon: "🧪" },
  { name: "Pesticides", icon: "🌿" },
  { name: "Seeds", icon: "🌱" },
  { name: "Dairy & Feed", icon: "🐄" },
  { name: "Machinery", icon: "🚜" },
  { name: "Irrigation", icon: "💧" },
];

async function getSetting(rows: { key: string; value: any }[] | null, key: string, fallback: string) {
  const row = rows?.find((r) => r.key === key);
  if (!row) return fallback;
  return typeof row.value === "string" ? row.value : String(row.value);
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();

  const [
    { count: farmerCount }, { count: productCount }, { count: dealerCount }, { data: farmerDistricts }, { data: categories }, { data: featuredProducts },
    { data: heroSlides }, { data: settingsRows }, { data: testimonials }, { data: latestPosts }, { data: galleryPreview },
  ] = await Promise.all([
    supabase.from("farmers").select("id", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("is_available", true),
    supabase.from("dealers").select("id", { count: "exact", head: true }).eq("verification_status", "verified").eq("is_active", true),
    supabase.from("farmers").select("district").eq("is_deleted", false).not("district", "is", null),
    supabase.from("categories").select("name").limit(8),
    supabase.from("products").select("id, name, selling_price, pack_size, image_url, categories(name), brands(name)").eq("is_deleted", false).eq("is_available", true).order("created_at", { ascending: false }).limit(4),
    supabase.from("hero_slides").select("*").eq("is_active", true).order("display_order"),
    supabase.from("website_settings").select("key, value"),
    supabase.from("testimonials").select("*").eq("is_published", true).order("display_order").limit(3),
    supabase.from("blog_posts").select("id, title, slug, excerpt, featured_image_url, category, published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(3),
    supabase.from("gallery_items").select("*").eq("is_published", true).order("display_order").limit(4),
  ]);

  // Distinct district count, computed here rather than via SQL COUNT(DISTINCT)
  // since Supabase's query builder doesn't expose distinct-count directly.
  const districtCount = new Set((farmerDistricts ?? []).map((f) => f.district?.trim().toLowerCase()).filter(Boolean)).size;

  const yearsOfTrust = await getSetting(settingsRows, "stats_years_of_trust", "15+");

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* HERO — dynamic slider if slides exist, otherwise the static hero  */}
      {/* ---------------------------------------------------------------- */}
      {heroSlides && heroSlides.length > 0 ? (
        <HeroSlider slides={heroSlides} />
      ) : (
        <section className="relative overflow-hidden border-b border-surface-200 bg-gradient-to-b from-brand-50 to-white px-4 py-20 dark:border-surface-800 dark:from-surface-900 dark:to-surface-950">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Pakistan&apos;s Trusted Agriculture Bridge
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-surface-900 dark:text-white sm:text-5xl">
              Connecting farmers, dealers &amp; investors —
              <span className="text-brand-600"> without ever crossing wires.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-surface-500 dark:text-surface-400">
              Al Rana Traders supplies certified seed, fertilizer, and crop protection to farmers across Pakistan — every order routed, verified, and settled by AgriBridge, the same way a bank sits between two accounts.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/contact"><Button size="md">Get Started — Contact Us</Button></Link>
              <Link href="/products"><Button variant="secondary" size="md">Browse Products</Button></Link>
              <Link href="/invest"><Button variant="ghost" size="md">Become a Partner</Button></Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* TRUST STATS — Districts, Farmers, Dealers, Products are all live */}
      {/* database counts, not admin-edited numbers.                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-surface-200 bg-white px-4 py-10 dark:border-surface-800 dark:bg-surface-950">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
          <Stat value={districtCount} label="Districts We Serve" />
          <Stat value={farmerCount ?? 0} label="Registered Farmers" />
          <Stat value={dealerCount ?? 0} label="Verified Dealers" />
          <Stat value={productCount ?? 0} label="Products Listed" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* HOW THE BRIDGE WORKS                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">How AgriBridge Works</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-surface-900 dark:text-white sm:text-3xl">One trusted middle, every side protected</h2>
          <p className="mx-auto mt-2 max-w-xl text-surface-500 dark:text-surface-400">
            Companies and dealers never deal with farmers directly, and farmers never deal with dealers directly — AgriBridge verifies, routes, and settles every order in between.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <BridgeStep number="01" icon={Building2} title="Company / Dealer supplies" description="Companies list products, dealers stock them locally by district — never in direct contact with the end farmer." />
          <BridgeStep number="02" icon={Handshake} title="AgriBridge routes & verifies" description="A farmer's order is matched to a dealer, verified by our team, and payment is settled — the same order both sides see, described differently." />
          <BridgeStep number="03" icon={Sprout} title="Farmer receives, under our name" description="Delivery reaches the farmer under the Al Rana Traders / AgriBridge identity — never the dealer's — so trust stays with the platform, not a stranger." />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CATEGORIES                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-surface-200 bg-surface-50 px-4 py-16 dark:border-surface-800 dark:bg-surface-900">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Shop by Category</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-surface-900 dark:text-white">Our Premium Categories</h2>
            </div>
            <Link href="/products" className="hidden items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400 sm:flex">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(categories && categories.length > 0 ? categories.map((c) => ({ name: c.name, icon: "🌾" })) : CATEGORY_FALLBACK).map((c) => (
              <Link key={c.name} href={`/products?category=${encodeURIComponent(c.name)}`} className="group rounded-card border border-surface-200 bg-white p-5 text-center shadow-card transition-shadow hover:shadow-lg dark:border-surface-800 dark:bg-surface-950">
                <span className="text-2xl">{c.icon}</span>
                <p className="mt-2 text-sm font-medium text-surface-900 group-hover:text-brand-700 dark:text-white">{c.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FEATURED PRODUCTS                                                */}
      {/* ---------------------------------------------------------------- */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">Latest Products</h2>
              <Link href="/products" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {featuredProducts.map((p: any) => (
                <div key={p.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-8 w-8 text-surface-300" />}
                  </div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">{[p.categories?.name, p.brands?.name].filter(Boolean).join(" - ") || p.pack_size}</p>
                  <p className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-400">{formatCurrency(p.selling_price)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* AI CROP DOCTOR TEASER                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-surface-200 bg-brand-900 px-4 py-16 text-white dark:border-surface-800">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 sm:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100">
              <Stethoscope className="h-3.5 w-3.5" /> Free for every registered farmer
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold sm:text-3xl">AI Crop Doctor — fasal bachao!</h2>
            <p className="mt-3 max-w-md text-brand-100">
              Upload a photo of an affected crop and get disease detection with a treatment and spray schedule — free, in minutes.
            </p>
            <Link href="/ai-crop-doctor" className="mt-6 inline-block">
              <Button size="md" className="bg-white text-brand-800 hover:bg-brand-50">Try AI Crop Doctor</Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MiniStep icon="📸" label="Upload Photo" />
            <MiniStep icon="🤖" label="AI Analysis" />
            <MiniStep icon="💊" label="Treatment Plan" />
            <MiniStep icon="🛒" label="Order Products" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* INVESTMENT / PARTNERSHIP TEASER                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-card border border-surface-200 bg-wheat-400/10 p-8 dark:border-surface-800 sm:p-10">
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-wheat-600">Business &amp; Investment</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-surface-900 dark:text-white">Invest in the future of agriculture</h2>
              <p className="mt-3 text-surface-500 dark:text-surface-400">
                Product investment, dairy &amp; livestock, corporation deals, and franchise opportunities — transparent, halal, and no cash required. AgriBridge holds the stock, sells through its dealer network, and returns your share.
              </p>
              <Link href="/invest" className="mt-6 inline-block">
                <Button size="md">Explore Partnership Models</Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <PartnerModel icon={Package} title="Product Investment" />
              <PartnerModel icon={Building2} title="Corporation Deal" />
              <PartnerModel icon={Sprout} title="Dairy & Livestock" />
              <PartnerModel icon={TrendingUp} title="Franchise" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* GALLERY PREVIEW                                                  */}
      {/* ---------------------------------------------------------------- */}
      {galleryPreview && galleryPreview.length > 0 && (
        <section className="border-t border-surface-200 px-4 py-16 dark:border-surface-800">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">From the Gallery</h2>
              <Link href="/gallery" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {galleryPreview.map((g) => (
                <Link key={g.id} href="/gallery" className="aspect-square overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
                  <img src={g.thumbnail_url || g.url} alt={g.caption ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* LATEST FROM THE BLOG                                             */}
      {/* ---------------------------------------------------------------- */}
      {latestPosts && latestPosts.length > 0 && (
        <section className="border-t border-surface-200 bg-surface-50 px-4 py-16 dark:border-surface-800 dark:bg-surface-900">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">Latest from the Blog</h2>
              <Link href="/blog" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {latestPosts.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-950">
                  {p.featured_image_url && <div className="aspect-video overflow-hidden bg-surface-100"><img src={p.featured_image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" /></div>}
                  <div className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{p.category}</p>
                    <h3 className="mt-1 font-display text-base font-semibold text-surface-900 group-hover:text-brand-700 dark:text-white">{p.title}</h3>
                    <p className="mt-2 text-xs text-surface-400 dark:text-surface-500">{formatDate(p.published_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* TESTIMONIALS                                                     */}
      {/* ---------------------------------------------------------------- */}
      {testimonials && testimonials.length > 0 && (
        <section className="border-t border-surface-200 px-4 py-16 dark:border-surface-800">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Satisfied Farmers</p>
            <h2 className="mt-2 text-center font-display text-2xl font-semibold text-surface-900 dark:text-white">Hamary Khush Farmers</h2>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.id} className="rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
                  <Quote className="h-5 w-5 text-brand-300" />
                  <p className="mt-3 text-sm text-surface-700 dark:text-surface-300">{t.quote}</p>
                  <p className="mt-4 text-sm font-semibold text-surface-900 dark:text-white">{t.customer_name}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">{t.location}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* FOUNDER NOTE + FRAUD ALERT                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <Quote className="h-6 w-6 text-brand-300" />
          <p className="mt-3 font-display text-lg text-surface-800 dark:text-surface-200">
            &ldquo;Hamaara maqsad sirf business nahi — Pakistan ki kheti aur kisaano ki tarakki hai. Ek khushhal kisan hi ek khushhal Pakistan banata hai.&rdquo;
          </p>
          <p className="mt-4 text-sm font-semibold text-surface-900 dark:text-white">Ch. Mahabal Ali</p>
          <p className="text-xs text-surface-400 dark:text-surface-500">Founder &amp; CEO, Al Rana Traders</p>
        </div>

        <div className="mt-6 flex gap-3 rounded-card border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Fraud alert:</strong> Al Rana Traders never accepts cash payment for a partnership or investment. Every deal happens through products or livestock, verified in writing. If anyone asks for cash in our name, report it to <a href="mailto:info@alranatraders.pk" className="underline">info@alranatraders.pk</a>.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* NEWSLETTER                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-surface-200 bg-surface-50 px-4 py-14 dark:border-surface-800 dark:bg-surface-900">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-xl font-semibold text-surface-900 dark:text-white">Stay Updated</h2>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">Get farming tips, new products, and business updates in your inbox.</p>
          <div className="mt-5">
            <NewsletterForm />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FINAL CTA                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-surface-200 bg-brand-600 px-4 py-14 text-center text-white dark:border-surface-800">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Grow Together. Earn Together. Build Together.</h2>
        <p className="mx-auto mt-2 max-w-lg text-brand-100">
          Whether you&apos;re a farmer, a dealer, a company, or an investor — Al Rana Traders is your complete agriculture business platform.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/contact"><Button size="md" className="bg-white text-brand-700 hover:bg-brand-50">Get Started Today</Button></Link>
          <Link href="/products"><Button size="md" variant="ghost" className="text-white hover:bg-white/10">Explore Products</Button></Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-brand-700 dark:text-brand-400 sm:text-3xl">{value.toLocaleString("en-PK")}+</p>
      <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{label}</p>
    </div>
  );
}

function BridgeStep({ number, icon: Icon, title, description }: { number: string; icon: any; title: string; description: string }) {
  return (
    <div className="relative rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <span className="font-display text-xs font-semibold text-surface-300 dark:text-surface-600">{number}</span>
      <div className="mt-2 mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-surface-500 dark:text-surface-400">{description}</p>
    </div>
  );
}

function MiniStep({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rounded-card bg-white/10 p-4 text-center backdrop-blur">
      <span className="text-2xl">{icon}</span>
      <p className="mt-2 text-xs font-medium text-brand-100">{label}</p>
    </div>
  );
}

function PartnerModel({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="rounded-card bg-white p-4 text-center shadow-card dark:bg-surface-800">
      <Icon className="mx-auto h-6 w-6 text-wheat-600" />
      <p className="mt-2 text-xs font-medium text-surface-800 dark:text-surface-200">{title}</p>
    </div>
  );
}