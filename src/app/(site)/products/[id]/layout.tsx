import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

type ProductLayoutProps = {
  children: React.ReactNode;
  params: { id: string };
};

export async function generateMetadata({ params }: Omit<ProductLayoutProps, "children">): Promise<Metadata> {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, pack_size, active_ingredient, image_url, categories(name), brands(name), companies(name)")
    .eq("id", params.id)
    .eq("is_deleted", false)
    .eq("is_available", true)
    .single();

  if (!product) {
    return {
      title: "Product Not Found",
      robots: { index: false, follow: false },
    };
  }

  const category = (product as any).categories?.name;
  const brand = (product as any).brands?.name;
  const company = (product as any).companies?.name;
  const descriptor = [category, brand || company, product.pack_size].filter(Boolean).join(" • ");
  const description = `${product.name}${descriptor ? ` — ${descriptor}` : ""}. View product details and availability on AgriBridge by Al Rana Traders.`;
  const canonical = `/products/${product.id}`;

  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${product.name} | AgriBridge`,
      description,
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : undefined,
    },
    twitter: {
      card: product.image_url ? "summary_large_image" : "summary",
      title: `${product.name} | AgriBridge`,
      description,
      images: product.image_url ? [product.image_url] : undefined,
    },
  };
}

export default function ProductLayout({ children }: ProductLayoutProps) {
  return children;
}
