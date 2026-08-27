"use client";
import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/form";

export function PaymentSlipUpload({ onUploaded }: { onUploaded?: (url: string) => void }) {
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
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
      const { error: uploadError } = await supabase.storage.from("payment-slips").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("payment-slips").getPublicUrl(path);
      setFileUrl(data.publicUrl);
      setFileName(file.name);
      onUploaded?.(data.publicUrl);
    } catch (err: any) {
      setError(err.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Label>Payment Slip (image or PDF)</Label>
      <input type="hidden" name="payment_slip_url" value={fileUrl} />
      {fileUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-brand-700 hover:underline">
            {fileName || "View uploaded slip"}
          </a>
          <button
            type="button"
            onClick={() => { setFileUrl(""); setFileName(""); }}
            className="ml-auto text-surface-400 hover:text-red-600"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-surface-300 text-surface-400 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800">
          <FileUp className="h-5 w-5" />
          <span className="text-xs">{uploading ? "Uploading..." : "Upload slip"}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
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