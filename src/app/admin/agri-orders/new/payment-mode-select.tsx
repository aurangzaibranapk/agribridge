"use client";
import { useState } from "react";
import { Wallet, NotebookPen } from "lucide-react";

/**
 * Payment Mode ka chunao. Ye seedha `agri_orders.payment_terms` mein
 * jata hai — koi alag column nahi, kyunke ye dono value us column mein
 * pehle se maujood hain.
 *
 * Dono order form (admin ka poora form aur POS ka simple form) yahi
 * component istemal karte hain, taake usool ek hi jagah likha rahe.
 */
const MODES = [
  {
    value: "Advance Payment",
    title: "Advance Order",
    subtitle: "Pehle poori payment, phir maal",
    detail: "Poori payment finance se verify hone tak warehouse dispatch nahi banayega. Khate par koi udhaar nahi charrhta.",
    Icon: Wallet,
  },
  {
    value: "Credit",
    title: "Base Order (Khata)",
    subtitle: "Maal pehle, paisa baad mein",
    detail: "Shop ki credit limit ke andar hona zaroori hai. GRN mukammal hone par poora amount shop ke khate mein charge hoga.",
    Icon: NotebookPen,
  },
] as const;

export function PaymentModeSelect({ defaultValue = "Credit" }: { defaultValue?: string }) {
  const [mode, setMode] = useState(defaultValue);

  return (
    <div>
      <input type="hidden" name="payment_terms" value={mode} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map(({ value, title, subtitle, detail, Icon }) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={selected}
              className={`rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-950/30"
                  : "border-surface-200 hover:border-surface-300 dark:border-surface-700"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${selected ? "text-brand-600" : "text-surface-400"}`} />
                <span className="text-sm font-semibold text-surface-900 dark:text-white">{title}</span>
              </span>
              <span className="mt-0.5 block text-xs font-medium text-surface-600 dark:text-surface-400">{subtitle}</span>
              <span className="mt-1 block text-xs text-surface-500">{detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
