import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function BlogListPage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
  const supabase = createClient();
  let query = supabase.from("blog_posts").select("*").eq("is_published", true).order("published_at", { ascending: false });
  if (searchParams.category) query = query.eq("category", searchParams.category);
  if (searchParams.q) query = query.ilike("title", `%${searchParams.q}%`);
  const { data: posts } = await query;

  const categories = ["Farming Tips", "Product Guides", "Company News", "Success Stories"];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">Blog</h1>
        <p className="mx-auto mt-2 max-w-lg text-surface-500 dark:text-surface-400">Farming tips, product guides, and stories from the field.</p>
      </div>

      <form className="mx-auto mt-8 flex max-w-md gap-2">
        <input
          name="q" defaultValue={searchParams.q} placeholder="Search articles..."
          className="h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/blog" className={`rounded-full px-3 py-1.5 text-sm ${!searchParams.category ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300"}`}>All</Link>
        {categories.map((c) => (
          <Link key={c} href={`/blog?category=${encodeURIComponent(c)}`} className={`rounded-full px-3 py-1.5 text-sm ${searchParams.category === c ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300"}`}>{c}</Link>
        ))}
      </div>

      {(!posts || posts.length === 0) ? (
        <p className="mt-10 text-center text-sm text-surface-400 dark:text-surface-500">No articles found.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="group overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              {p.featured_image_url && (
                <div className="aspect-video overflow-hidden bg-surface-100">
                  <img src={p.featured_image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
              )}
              <div className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{p.category}</p>
                <h2 className="mt-1 font-display text-base font-semibold text-surface-900 group-hover:text-brand-700 dark:text-white">{p.title}</h2>
                {p.excerpt && <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{p.excerpt}</p>}
                <p className="mt-2 text-xs text-surface-400 dark:text-surface-500">{formatDate(p.published_at ?? p.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
