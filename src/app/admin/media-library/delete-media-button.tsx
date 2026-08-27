"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeleteMediaButton({ id, fileUrl }: { id: string; fileUrl: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Kya aap is image ko delete karna chahte hain?")) return;
    setDeleting(true);
    const supabase = createClient();
    try {
      const match = fileUrl.match(/website-media\/(.+)$/);
      if (match) {
        await supabase.storage.from("website-media").remove([match[1]]);
      }
      await supabase.from("media_library").delete().eq("id", id);
      router.refresh();
    } catch {
      alert("Delete karne mein masla hua.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
    >
      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {deleting ? "..." : "Delete"}
    </button>
  );
}