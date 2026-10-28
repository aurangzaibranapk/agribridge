"use client";

import { useMemo, useState } from "react";
import { Check, Egg, Milk, MessageCircle, Minus, Package, Plus } from "lucide-react";
import { DAIRY_PRODUCTS, SUPPLY, WHATSAPP_DISPLAY, whatsappLink } from "@/lib/dairy-public/offer";
import { buildCheckoutText, checkoutTotals, type CheckoutCity, type PayMethod } from "@/lib/dairy-public/checkout";

/**
 * Glassy dairy checkout. Sirf WhatsApp prefilled kholta hai -- kuch save
 * ya khud send nahi hota. Bhejna customer khud dabata hai.
 */
const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;
const CSS = `.dg-glass{background:rgba(255,255,255,.62);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border:1px solid rgba(255,255,255,.8);box-shadow:0 18px 50px rgba(15,31,58,.10),inset 0 1px 0 rgba(255,255,255,.9);border-radius:22px}
.dark .dg-glass{background:rgba(18,32,60,.62);border-color:rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.45)}
.dg-opt{border:1px solid rgba(15,31,58,.12);background:rgba(255,255,255,.55);border-radius:14px}.dark .dg-opt{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.05)}
.dg-opt[aria-pressed=true]{border:2px solid #1f9d5c;background:rgba(31,157,92,.08);box-shadow:0 8px 24px rgba(31,157,92,.18)}`;

export function GlassCheckout() {
  const [city, setCity] = useState<CheckoutCity>("Lahore");
  const [qty, setQty] = useState({ milk: SUPPLY.lahoreMinimumLitres, ghee: 0, eggs: 0 });
  const [pay, setPay] = useState<PayMethod>("cod");
  const [who, setWho] = useState({ name: "", phone: "", area: "", business: "" });
  const t = useMemo(() => checkoutTotals({ city, milkL: qty.milk, gheeKg: qty.ghee, eggs: qty.eggs }), [city, qty]);
  const ready = who.name.trim() !== "" && !t.empty && !t.belowMin;
  const meta = { "doodh-13-ts": { k: "milk" as const, step: 50, unit: "L", i: <Milk className="h-6 w-6" /> }, "desi-ghee": { k: "ghee" as const, step: 1, unit: "kg", i: <Package className="h-6 w-6" /> }, "desi-anday": { k: "eggs" as const, step: 30, unit: "", i: <Egg className="h-6 w-6" /> } };
  const input = "h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm text-[#0f1f3a] outline-none focus:border-[#1f9d5c] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]" data-testid="glass-checkout">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="space-y-4">
        <section className="dg-glass p-5">
          <p className="mb-2 font-semibold text-[#0f1f3a] dark:text-white">1. Aap ka order · <span lang="ur">آپ کا آرڈر</span></p>
          {t.lines.map((l) => {
            const p = DAIRY_PRODUCTS.find((x) => x.id === l.id)!; const m = meta[l.id];
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-black/5 py-3 last:border-0 dark:border-white/10">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-[#1e3a6e]/15 text-emerald-700 dark:text-emerald-300">{m.i}</span>
                <div className="min-w-[140px] flex-1"><p className="font-semibold text-[#0f1f3a] dark:text-white">{p.nameRoman}</p><p className="text-xs text-[#5b6675] dark:text-[#9fb0c8]">{rs(l.price)} {p.offers.find((o) => o.city === city)?.unitText ?? p.offers[0].unitText}</p></div>
                <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white/70 p-1 dark:border-white/10 dark:bg-white/5">
                  <button type="button" aria-label="Kam" className="grid h-8 w-8 place-items-center" onClick={() => setQty({ ...qty, [m.k]: Math.max(0, qty[m.k] - m.step) })}><Minus className="h-4 w-4" /></button>
                  <input aria-label={p.nameRoman} inputMode="numeric" className="w-16 bg-transparent text-center text-sm font-semibold outline-none" value={qty[m.k]} onChange={(e) => setQty({ ...qty, [m.k]: Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
                  <button type="button" aria-label="Zyada" className="grid h-8 w-8 place-items-center" onClick={() => setQty({ ...qty, [m.k]: qty[m.k] + m.step })}><Plus className="h-4 w-4" /></button>
                </div>
                <b className="w-24 text-right text-[#0f1f3a] dark:text-white">{rs(l.total)}</b>
              </div>
            );
          })}
        </section>
        <section className="dg-glass p-5">
          <p className="mb-2 font-semibold text-[#0f1f3a] dark:text-white">2. Shehar · <span lang="ur">شہر</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["Lahore", "Islamabad"] as const).map((c) => (
              <button key={c} type="button" aria-pressed={city === c} onClick={() => setCity(c)} className="dg-opt p-3 text-left text-sm text-[#0f1f3a] dark:text-white">
                <b>{c}</b><br />Doodh {rs(DAIRY_PRODUCTS[0].offers.find((o) => o.city === c)!.price)} / L{c === "Lahore" ? ` · min ${SUPPLY.lahoreMinimumLitres} L` : ""}
              </button>
            ))}
          </div>
        </section>
        <section className="dg-glass p-5">
          <p className="mb-2 font-semibold text-[#0f1f3a] dark:text-white">3. Adaigi ka tareeqa · <span lang="ur">ادائیگی</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" aria-pressed={pay === "cod"} onClick={() => setPay("cod")} className="dg-opt p-4 text-left text-[#0f1f3a] dark:text-white"><b>Cash on Delivery</b><p className="text-xs text-[#5b6675] dark:text-[#9fb0c8]">Maal milne par cash dein</p></button>
            <button type="button" aria-pressed={pay === "advance"} onClick={() => setPay("advance")} className="dg-opt p-4 text-left text-[#0f1f3a] dark:text-white"><b>Advance payment</b><p className="text-xs text-[#5b6675] dark:text-[#9fb0c8]">Staff confirm kar ke account batayega</p></button>
          </div>
        </section>
      </div>
      <aside className="dg-glass h-fit bg-gradient-to-b from-emerald-500/10 to-transparent p-5">
        <p className="text-[11px] uppercase tracking-wide text-[#7a889c]">Order summary · <span lang="ur">خلاصہ</span></p>
        <div className="my-3 space-y-2 text-sm text-[#0f1f3a] dark:text-white">
          {t.lines.filter((l) => l.qty > 0).map((l) => <p key={l.id} className="flex justify-between"><span>{DAIRY_PRODUCTS.find((x) => x.id === l.id)!.nameRoman} {l.qty}{meta[l.id].unit ? ` ${meta[l.id].unit}` : ""} × {rs(l.price)}</span><b>{rs(l.total)}</b></p>)}
          <p className="flex justify-between border-t border-dashed border-black/15 pt-2 dark:border-white/15"><span>Delivery</span><span>Thandi gaari · tasdeeq par</span></p>
        </div>
        <div className="flex items-baseline justify-between border-t border-black/10 py-3 dark:border-white/10"><b className="text-[#0f1f3a] dark:text-white">Kul raqam</b><span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300" data-testid="checkout-total">{rs(t.total)}</span></div>
        {t.belowMin && <p className="mb-2 text-xs font-semibold text-rose-600">Lahore mein kam se kam {SUPPLY.lahoreMinimumLitres} litre doodh.</p>}
        <div className="space-y-2">
          <input className={input} placeholder="Naam *" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} />
          <input className={input} placeholder="Karobar (hotel, bakery...)" value={who.business} onChange={(e) => setWho({ ...who, business: e.target.value })} />
          <input className={input} placeholder="Delivery ka area / pata" value={who.area} onChange={(e) => setWho({ ...who, area: e.target.value })} />
        </div>
        <a
          aria-disabled={!ready}
          href={ready ? whatsappLink(buildCheckoutText({ name: who.name, business: who.business, city, area: who.area, milkLitresPerDay: qty.milk ? String(qty.milk) : "", gheeKg: qty.ghee ? String(qty.ghee) : "", eggs: qty.eggs ? String(qty.eggs) : "", pay, total: t.total })) : undefined}
          target="_blank" rel="noopener noreferrer"
          className={`mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#1f9d5c] to-[#137043] font-semibold text-white shadow-[0_10px_26px_rgba(31,157,92,.35)] ${ready ? "" : "pointer-events-none opacity-50"}`}
          data-testid="checkout-wa"
        >
          <Check className="h-4 w-4" /> WhatsApp par order kholein
        </a>
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-[#5b6675] dark:text-[#9fb0c8]"><MessageCircle className="h-3.5 w-3.5" />{WHATSAPP_DISPLAY} · WhatsApp sirf khulta hai, message aap khud bhejte hain.</p>
      </aside>
    </div>
  );
}
