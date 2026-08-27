"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/form";

export function ProductImageUpload({ defaultUrl, onUploaded }: { defaultUrl?: string; onUploaded?: (url: string) => void }) {
  const [imageUrl, setImageUrl] = useState(defaultUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("products").upload(path, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      onUploaded?.(data.publicUrl);
    } catch (err: any) {
      setError(err.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label>Product Image</Label>
      <input type="hidden" name="image_url" value={imageUrl} />

      {imageUrl ? (
        <div className="relative inline-block">
          <img src={imageUrl} alt="Product preview" className="h-28 w-28 rounded-lg border border-surface-200 object-cover dark:border-surface-700" />
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-surface-300 text-surface-400 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800">
          <ImagePlus className="h-6 w-6" />
          <span className="text-xs">{uploading ? "Uploading..." : "Upload"}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
