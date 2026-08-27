import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export async function StaticPageView({ slug }: { slug: string }) {
  const supabase = createClient();
  const { data: page } = await supabase.from("static_pages").select("*").eq("slug", slug).single();
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">{page.title}</h1>
      <p className="mt-1 text-xs text-surface-400 dark:text-surface-500">Last updated: {formatDate(page.updated_at)}</p>
      <div className="prose prose-surface mt-8 max-w-none whitespace-pre-line text-surface-700 dark:text-surface-300">
        {page.content}
      </div>
    </div>
  );
}
