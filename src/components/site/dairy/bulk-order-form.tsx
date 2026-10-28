"use client";

import { useState } from "react";
import { buildBulkOrderText, whatsappLink, type BulkOrderInput } from "@/lib/dairy-public/offer";

/**
 * Bulk order form. Ye kuch save ya send nahi karta: sirf WhatsApp
 * prefilled text ke sath kholta hai. Bhejna customer khud dabata hai.
 */
const FIELDS: { key: keyof BulkOrderInput; label: string; required?: boolean; placeholder?: string }[] = [
  { key: "name", label: "Naam · نام", required: true },
  { key: "business", label: "Karobar · کاروبار", placeholder: "Hotel, bakery, mithai shop..." },
  { key: "city", label: "Shehar · شہر", required: true, placeholder: "Lahore, Islamabad..." },
  { key: "area", label: "Area · علاقہ" },
  { key: "milkLitresPerDay", label: "Doodh, litre rozana · دودھ (لیٹر روزانہ)", placeholder: "200" },
  { key: "gheeKg", label: "Desi ghee, kg · دیسی گھی (کلو)" },
  { key: "eggs", label: "Desi anday, tadaad · دیسی انڈے (تعداد)" },
];

const input =
  "mt-1 w-full rounded-xl border border-[#e8e1d2] bg-white px-3 py-2.5 text-sm text-[#1d2a3a] outline-none focus:border-[#1f6f4a] dark:border-[#22365a] dark:bg-[#0f1c31] dark:text-[#eef2f8]";

export function BulkOrderForm() {
  const [v, setV] = useState<BulkOrderInput>({ name: "", city: "" });
  const ready = v.name.trim() !== "" && v.city.trim() !== "";

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        window.open(whatsappLink(buildBulkOrderText(v)), "_blank", "noopener,noreferrer");
      }}
    >
      {FIELDS.map((f) => (
        <label key={f.key} className="text-sm font-semibold text-[#1d2a3a] dark:text-[#eef2f8]">
          {f.label}
          {f.required && <span className="text-red-600"> *</span>}
          <input
            className={input}
            name={f.key}
            required={f.required}
            placeholder={f.placeholder}
            value={(v[f.key] as string) ?? ""}
            onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
          />
        </label>
      ))}
      <label className="text-sm font-semibold text-[#1d2a3a] sm:col-span-2 dark:text-[#eef2f8]">
        Note · نوٹ
        <textarea className={input} rows={3} name="note" value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value })} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={!ready} className="rounded-xl bg-[#1f8f4e] px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
          WhatsApp par bhejne ke liye kholein
        </button>
        <p className="mt-2 text-xs text-[#5b6675] dark:text-[#9fb0c8]">
          Ye button sirf WhatsApp kholta hai, khud kuch nahi bhejta. Message aap khud bhejenge, phir hamara staff rabta kar ke confirm karega.
        </p>
      </div>
    </form>
  );
}
