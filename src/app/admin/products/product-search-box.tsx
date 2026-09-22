"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Malik (19 September): "products search nahi ho rahi" -- asal masla
 * ye tha ke search box ek plain HTML form tha, sirf Enter dabane par
 * chalta tha (koi button, koi ishara nahi ke Enter dabana hai). Type
 * kar ke rukna khud-ba-khud kuch nahi karta tha.
 *
 * Ab type karte hi (chhoti si ruk kar, taake har harf par safha na
 * uchhle) khud search ho jati hai -- jaisa CRM/POS ki tarah baqi
 * search boxes is app mein pehle se karte hain.
 */
export function ProductSearchBox({
  initialQuery,
  cat,
  placeholder,
}: {
  initialQuery: string;
  cat: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (cat) params.set("cat", cat);
      if (value.trim()) params.set("q", value.trim());
      router.push(`/admin/products${params.toString() ? `?${params}` : ""}`);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full max-w-md rounded-lg border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  );
}
