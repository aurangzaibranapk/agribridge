import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

export default async function AdminStaticPagesPage() {
  const supabase = createClient();
  const { data: pages } = await supabase.from("static_pages").select("*").order("title");

  return (
    <div>
      <PageHeader title="Static Pages" description="Privacy Policy, Terms, Cookie Policy, Refund Policy, Disclaimer" />
      <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wide text-surface-400 dark:border-surface-800 dark:text-surface-500">
              <th className="px-5 py-3">Page</th>
              <th className="px-5 py-3">URL</th>
            </tr>
          </thead>
          <tbody>
            {(pages ?? []).map((p) => (
              <tr key={p.slug} className="border-b border-surface-50 last:border-0 dark:border-surface-800/60">
                <td className="px-5 py-3">
                  <Link href={`/admin/static-pages/${p.slug}`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">{p.title}</Link>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-surface-500 dark:text-surface-400">/{p.slug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
