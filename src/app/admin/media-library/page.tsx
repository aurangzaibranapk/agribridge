import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { MediaUploader } from "@/app/admin/media-library/media-uploader";
import { CopyUrlButton } from "@/app/admin/media-library/copy-url-button";
import { DeleteMediaButton } from "@/app/admin/media-library/delete-media-button";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  const supabase = createClient();
  const { data: files } = await supabase.from("media_library").select("*").order("created_at", { ascending: false });
  return (
    <div>
      <PageHeader title="Media Library" description="Upload images/videos here, then copy the URL into Blog, Gallery, Testimonials, or Hero Slider forms" />
      <MediaUploader />
      <div className="mt-8">
        {!files || files.length === 0 ? (
          <EmptyState title="No files uploaded yet" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((f) => (
              <div key={f.id} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-100 dark:bg-surface-800">
                  {f.file_type?.startsWith("image/") ? (
                    <img src={f.file_url} alt={f.file_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-surface-400">{f.file_type}</span>
                  )}
                </div>
                <p className="truncate text-sm text-surface-600 dark:text-surface-400" title={f.file_name}>{f.file_name}</p>
                <CopyUrlButton url={f.file_url} />
                <DeleteMediaButton id={f.id} fileUrl={f.file_url} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}