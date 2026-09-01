"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Camera, Sparkles } from "lucide-react";
import { createBillRead, type BillRateState } from "@/actions/supplier-bill-rates";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Label, Select } from "@/components/ui/form";

const initial: BillRateState = {};

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" /> {pending ? "AI parh rahi hai…" : "Bill parhwayein"}
      </span>
    </Button>
  );
}

export function NewBillForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createBillRead, initial);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.billId) router.push(`/admin/products/bill-rates/${state.billId}`);
  }, [state.billId, router]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const path = `bills/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("products").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Tasveer nahi charh saki.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="image_url" value={imageUrl} />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label>Bill ki photo</Label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Bill"
                  className="h-24 w-24 rounded-lg border border-surface-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="text-xs text-surface-500 underline"
                >
                  doosri lagayein
                </button>
              </div>
            ) : (
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-surface-300 text-surface-500 hover:bg-surface-50">
                <Camera className="h-6 w-6" />
                <span className="text-xs">{uploading ? "charh rahi hai…" : "Photo lagayein ya camera se lein"}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
            )}
            {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
          </div>

          <div>
            <Label htmlFor="sup">Supplier (agar maloom ho)</Label>
            <Select id="sup" name="supplier_id" defaultValue="" className="w-full">
              <option value="">— bill par jo naam ho wohi —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-surface-500">
              Supplier chunna zaroori nahi. Bill par likha naam waise bhi mehfooz rehta hai.
            </p>
          </div>
        </div>

        <Submit disabled={!imageUrl} />
      </form>

      {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state.notice && <p className="mt-2 text-sm text-emerald-700">{state.notice}</p>}
    </Card>
  );
}
