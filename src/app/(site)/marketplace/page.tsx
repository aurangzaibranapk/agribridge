import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Beef,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sprout,
  Wheat,
} from "lucide-react";

import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";

export const metadata: Metadata = {
  title: "Marketplace — AgriBridge",
  description:
    "Fertilizer, pesticide, seed, wanda aur agriculture products — AgriBridge ke connected marketplace se.",
};

/**
 * Marketplace ka darwaza.
 *
 * =====================================================================
 * ASAL DUKAN `/marketplace/shop` PAR HAI -- MITAI NAHI GAYI
 * =====================================================================
 *
 * Malik ki hidayat saaf thi: *"duplicate marketplace database nahi
 * banana"*, aur *"products table, orders table, cart, checkout,
 * inventory, API -- NAHI banana."*
 *
 * `/marketplace` par pehle se ek CHALTA HUA safha tha jis mein cart aur
 * checkout dono the (`submitMarketplaceCart` se asal order banta hai).
 * Ye design shell us ki jagah lagta, to website ka **ekloata public
 * ordering raasta** khamoshi se khatam ho jata -- aur wo baat kisi
 * screenshot mein nazar bhi nahi aati.
 *
 * Is liye wo poora safha `/marketplace/shop` par le jaya gaya hai (ek
 * bhi lakeer badle baghair), aur yahan ka pehla button usi par jata
 * hai. Category ke card design ke mutabiq `/products` par jate hain --
 * wo bhi pehle se maujood asal catalog hai.
 */

const categories = [
  {
    title: "Fertilizer",
    description: "Crop nutrition aur fertilizer products.",
    icon: Sprout,
    href: "/products?category=fertilizer",
  },
  {
    title: "Pesticides",
    description: "Crop protection aur pest management products.",
    icon: ShieldCheck,
    href: "/products?category=pesticide",
  },
  {
    title: "Seeds",
    description: "Different crops ke quality seed options.",
    icon: Wheat,
    href: "/products?category=seed",
  },
  {
    title: "Wanda & Feed",
    description: "Dairy aur livestock nutrition products.",
    icon: Beef,
    href: "/products?category=wanda",
  },
  {
    title: "Farm Essentials",
    description: "Daily agriculture aur farm-use products.",
    icon: ShoppingBag,
    href: "/products",
  },
  {
    title: "Machinery Services",
    description: "Agricultural machinery aur booking services.",
    icon: PackageSearch,
    href: "/machinery",
  },
];

const benefits = ["Verified Products", "Transparent Information", "Farmer Support", "Connected Ordering"];

export default function MarketplacePage() {
  return (
    <main>
      <PageHero
        eyebrow="AgriBridge Marketplace"
        title="Everything Your Farm"
        highlight="Needs."
        description="Fertilizer, pesticide, seed, wanda aur agriculture products ko AgriBridge ke connected marketplace se explore karein."
        primaryLabel="Explore Products"
        primaryHref="/marketplace/shop"
        secondaryLabel="Farmer Services"
        secondaryHref="/kisan-services"
      />

      {/* SEARCH */}
      <section className="relative z-10 -mt-7 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/marketplace/shop"
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-950/5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Search className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-950">Search AgriBridge Marketplace</p>
              <p className="truncate text-sm text-slate-500">
                Product, category, brand ya company search karein
              </p>
            </div>

            <ArrowRight className="h-5 w-5 shrink-0 text-emerald-700" />
          </Link>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Shop by Category"
            title="Farm ke liye jo chahiye, ek jagah"
            description="Agri inputs aur related services ko category ke mutabiq explore karein."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(({ title, description, icon: Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>

                  <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
                </div>

                <h3 className="mt-6 text-xl font-black text-slate-950">{title}</h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT SYSTEM ENTRY */}
      <section className="bg-[#f5f8f2] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                Connected Marketplace
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Products sirf dekhein nahi — apne AgriBridge ecosystem se connect karein.
              </h2>

              <p className="mt-5 max-w-xl leading-7 text-slate-600">
                Existing product catalog, categories, brands aur ordering system ko public marketplace ke
                saath connect rakha gaya hai.
              </p>

              <Link
                href="/products"
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white transition hover:bg-emerald-800"
              >
                View All Products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {benefits.map((item) => (
                <div key={item} className="rounded-2xl border border-emerald-950/10 bg-white p-6">
                  <BadgeCheck className="h-6 w-6 text-emerald-700" />
                  <p className="mt-4 font-bold text-slate-950">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[#0c2d22] px-6 py-12 text-center text-white sm:px-10 lg:py-16">
            <p className="font-bold text-emerald-300">ART AGRIBRIDGE MARKETPLACE</p>

            <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black sm:text-4xl">
              Agriculture products aur farmer services — one connected platform.
            </h2>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/marketplace/shop"
                className="rounded-xl bg-white px-6 py-3 font-bold text-emerald-950"
              >
                Browse Products
              </Link>

              <Link
                href="/contact"
                className="rounded-xl border border-white/20 px-6 py-3 font-bold text-white"
              >
                Get Help
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
