import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const STATIC_SERVICES = [
  { title: "Farm Advisory", url: "/services", text: "Soil and water test guidance, crop planning support, and field visits." },
  { title: "AI Crop Doctor", url: "/ai-crop-doctor", text: "Upload a crop photo and get instant disease detection with treatment." },
  { title: "Khata Accounts", url: "/services", text: "Buy now, settle later — a running account for farmers and dealers." },
  { title: "Reliable Supply", url: "/services", text: "Consistent stock of seed, fertilizer, and crop protection products." },
];

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();

  const [{ data: products }, { data: posts }, { data: faqs }] = q
    ? await Promise.all([
        supabase.from("products").select("id, name, pack_size").eq("is_deleted", false).eq("is_available", true).ilike("name", `%${q}%`).limit(10),
        supabase.from("blog_posts").select("id, title, slug").eq("is_published", true).ilike("title", `%${q}%`).limit(10),
        supabase.from("faqs").select("id, question").eq("is_published", true).or(`question.ilike.%${q}%,answer.ilike.%${q}%`).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const services = q ? STATIC_SERVICES.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()) || s.text.toLowerCase().includes(q.toLowerCase())) : [];

  const hasResults = (products?.length ?? 0) + (posts?.length ?? 0) + (faqs?.length ?? 0) + services.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">Search Results {q && <span className="text-surface-400">for &ldquo;{q}&rdquo;</span>}</h1>

      {!q && <p className="mt-4 text-sm text-surface-500 dark:text-surface-400">{t("sp_search_start", lang)}</p>}
      {q && !hasResults && <p className="mt-4 text-sm text-surface-500 dark:text-surface-400">{t("sp_no_results", lang)}</p>}

      {(products?.length ?? 0) > 0 && (
        <ResultSection title={t("sp_products", lang)}>
          {products!.map((p) => <Link key={p.id} href={`/products`} className="block rounded-card border border-surface-200 bg-white p-3 text-sm hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-200">{p.name} {p.pack_size && <span className="text-surface-400">({p.pack_size})</span>}</Link>)}
        </ResultSection>
      )}
      {services.length > 0 && (
        <ResultSection title={t("sp_services", lang)}>
          {services.map((s) => <Link key={s.title} href={s.url} className="block rounded-card border border-surface-200 bg-white p-3 text-sm hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-200"><span className="font-medium">{s.title}</span> — {s.text}</Link>)}
        </ResultSection>
      )}
      {(posts?.length ?? 0) > 0 && (
        <ResultSection title={t("sp_blog", lang)}>
          {posts!.map((p) => <Link key={p.id} href={`/blog/${p.slug}`} className="block rounded-card border border-surface-200 bg-white p-3 text-sm hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-200">{p.title}</Link>)}
        </ResultSection>
      )}
      {(faqs?.length ?? 0) > 0 && (
        <ResultSection title={t("sf_faq", lang)}>
          {faqs!.map((f) => <Link key={f.id} href="/faq" className="block rounded-card border border-surface-200 bg-white p-3 text-sm hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-200">{f.question}</Link>)}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-surface-400 dark:text-surface-500">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
