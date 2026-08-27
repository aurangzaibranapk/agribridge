"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();

    try {
      for (const file of Array.from(fileList)) {
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage.from("website-media").upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("website-media").getPublicUrl(path);
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from("media_library").insert({
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          uploaded_by: user?.id,
        });
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-surface-300 bg-surface-50 p-8 text-center hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800">
        <UploadCloud className="h-8 w-8 text-surface-400" />
        <span className="text-sm font-medium text-surface-600 dark:text-surface-300">{uploading ? "Uploading..." : "Click to upload images or videos"}</span>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} disabled={uploading} />
      </label>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
