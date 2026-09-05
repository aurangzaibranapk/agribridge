import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: post } = await supabase.from("blog_posts").select("title, excerpt").eq("slug", params.slug).single();
  return { title: post?.title ?? "Blog", description: post?.excerpt ?? undefined };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: post } = await supabase.from("blog_posts").select("*").eq("slug", params.slug).eq("is_published", true).single();
  if (!post) notFound();

  const { data: related } = await supabase
    .from("blog_posts")
    .select("id, title, slug, featured_image_url")
    .eq("is_published", true)
    .eq("category", post.category)
    .neq("id", post.id)
    .limit(3);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">{post.category}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-surface-900 dark:text-white">{post.title}</h1>
      <p className="mt-2 text-sm text-surface-400 dark:text-surface-500">{formatDate(post.published_at ?? post.created_at)}</p>

      {post.featured_image_url && (
        <img src={post.featured_image_url} alt={post.title} className="mt-6 w-full rounded-card object-cover" />
      )}

      <div className="prose prose-surface mt-8 max-w-none whitespace-pre-line text-surface-700 dark:text-surface-300">
        {post.content}
      </div>

      {related && related.length > 0 && (
        <div className="mt-16 border-t border-surface-200 pt-8 dark:border-surface-800">
          <h2 className="mb-4 font-display text-lg font-semibold text-surface-900 dark:text-white">{t("sp_related_articles", lang)}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.id} href={`/blog/${r.slug}`} className="rounded-card border border-surface-200 bg-white p-3 text-sm font-medium text-surface-800 hover:text-brand-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-200">
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
