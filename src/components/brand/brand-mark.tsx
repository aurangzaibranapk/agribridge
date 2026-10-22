import { Leaf } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

/** Chhota nishan. Koi harf nahi — naam us ke bagal wale lafz mein hai. */
export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white shadow-sm ${className}`}
      aria-hidden="true"
    >
      <Leaf className="h-1/2 w-1/2" strokeWidth={2.25} />
    </span>
  );
}

/** Naam ka hissa "Bridge" hara. Naam badle to poora lafz dikhe. */
export function BrandWord({ className = "" }: { className?: string }) {
  const name = BRAND_NAME;
  const cut = name.endsWith("Bridge") ? name.length - "Bridge".length : 0;
  if (cut <= 0) return <span className={className}>{name}</span>;
  return (
    <span className={className}>
      {name.slice(0, cut)}
      <span className="text-emerald-700">{name.slice(cut)}</span>
    </span>
  );
}
