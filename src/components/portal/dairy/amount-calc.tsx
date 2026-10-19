"use client";
import { useEffect, useRef } from "react";
/** Qty × rate = raqam (sirf dikhane ke liye; server dobara hisaab karta hai). */
export function AmountCalc({ className, placeholder }: { className: string; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const calc = () => {
      const q = Number((form.elements.namedItem("qty") as HTMLInputElement)?.value || NaN);
      const r = Number((form.elements.namedItem("rate") as HTMLInputElement)?.value || NaN);
      if (Number.isFinite(q) && Number.isFinite(r) && ref.current) ref.current.value = String(Math.round(q * r * 100) / 100);
    };
    form.addEventListener("input", calc);
    return () => form.removeEventListener("input", calc);
  }, []);
  return <input ref={ref} name="amount" inputMode="decimal" placeholder={placeholder} className={className} />;
}
