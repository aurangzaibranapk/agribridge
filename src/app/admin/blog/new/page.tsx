import { PageHeader } from "@/components/ui/layout-primitives";
import { BlogPostForm } from "@/app/admin/blog/blog-post-form";

export const dynamic = "force-dynamic";

export default function NewBlogPostPage() {
  return (
    <div>
      <PageHeader title="New Blog Post" />
      <BlogPostForm />
    </div>
  );
}