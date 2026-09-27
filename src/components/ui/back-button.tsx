"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * "Jis page se aaye usi par wapas jaana" -- malik (19 September).
 *
 * Sidebar link ya fixed URL istemal nahi kiya, kyunke bohot se safhon
 * (jaise Reorder) par ek se zyada raaste se pahuncha ja sakta hai
 * (Needs Attention chip, Command Center, Product Management sidebar) --
 * browser history (`router.back()`) hamesha wahi safha deti hai jahan se
 * asal mein banda aaya tha, chahe wo kahin se bhi ho.
 */
export function BackButton({ label = "Back", fallback: _fallback }: { label?: string; fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-2 flex items-center gap-1 text-sm font-medium text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-surface-200"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
