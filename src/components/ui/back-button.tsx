"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Peechhe jane ka button.
 *
 * Ye jaan boojh kar browser ki apni history par chalta hai, kisi tay
 * shuda safhe par nahi. Wajah: is safhe tak kai raaste aate hain --
 * qatar se, fehrist se, kisan ke safhe se, ya kisan ki farmaish se.
 * "Machinery par wapas" likh kar sab ko ek hi jagah bhej dena us bande
 * ko us jagah se hata deta hai jahan wo kaam kar raha tha, aur usay
 * dobara wahan tak pohanchna parta hai.
 *
 * History khali ho (kisi ne seedha link khola ho) to `fallback` par
 * jata hai -- warna button dab kar kuch nahi hota, jo us se bhi bura
 * hai.
 */
export function BackButton({ fallback = "/admin", label }: { fallback?: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-surface-500 transition hover:text-brand-700 dark:hover:text-brand-300"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
