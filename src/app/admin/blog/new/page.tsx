import { PageHeader } from "@/components/ui/layout-primitives";
import { BlogPostForm } from "@/app/admin/blog/blog-post-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default function NewBlogPostPage() {
  const lang = getLanguageFromCookies("rm");
  return (
    <div>
      <PageHeader title={t("bg_new_post_page", lang)} />
      <BlogPostForm />
    </div>
  );
}