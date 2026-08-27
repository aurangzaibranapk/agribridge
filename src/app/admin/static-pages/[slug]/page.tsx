import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StaticPageForm } from "@/app/admin/static-pages/[slug]/static-page-form";

export const dynamic = "force-dynamic";

export default async function EditStaticPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: page } = await supabase.from("static_pages").select("*").eq("slug", params.slug).single();
  if (!page) notFound();

  return (
    <div>
      <PageHeader title={`Edit: ${page.title}`} />
      <StaticPageForm page={page} />
    </div>
  );
}
