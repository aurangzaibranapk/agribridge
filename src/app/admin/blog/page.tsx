import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge, Button } from "@/components/ui/form";
import { formatDate } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: posts } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title={t("bg_blog", lang)}
        description="Articles shown on the public /blog page"
        actions={<Link href="/admin/blog/new"><Button size="sm">{t("bg_new_post", lang)}</Button></Link>}
      />
      {!posts || posts.length === 0 ? (
        <EmptyState title={t("bg_none_yet", lang)} description="Create your first post." />
      ) : (
        <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wide text-surface-400 dark:border-surface-800 dark:text-surface-500">
                <th className="px-5 py-3">{t("c_title", lang)}</th>
                <th className="px-5 py-3">{t("c_category", lang)}</th>
                <th className="px-5 py-3">{t("c_status", lang)}</th>
                <th className="px-5 py-3 text-right">{t("bg_created", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/blog/${p.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">{p.title}</Link>
                  </td>
                  <td className="px-5 py-3 text-surface-600 dark:text-surface-300">{p.category ?? "—"}</td>
                  <td className="px-5 py-3"><Badge tone={p.is_published ? "green" : "gray"}>{p.is_published ? "Published" : "Draft"}</Badge></td>
                  <td className="px-5 py-3 text-right text-xs text-surface-400 dark:text-surface-500">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
