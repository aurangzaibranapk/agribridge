import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BlogPostForm } from "@/app/admin/blog/blog-post-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteBlogPost } from "@/actions/cms";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: post } = await supabase.from("blog_posts").select("*").eq("id", params.id).single();
  if (!post) notFound();

  return (
    <div>
      <PageHeader title="Edit Blog Post" actions={<DeleteButton id={post.id} action={deleteBlogPost} />} />
      <BlogPostForm post={post} />
    </div>
  );
}
