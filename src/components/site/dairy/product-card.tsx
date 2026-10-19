import { ImageIcon } from "lucide-react";
import type { DairyProduct } from "@/lib/dairy-public/offer";
import { Ur } from "./urdu";
import { WhatsAppButton } from "./whatsapp-button";

const rs = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export function DairyProductCard({ p }: { p: DairyProduct }) {
  return (
    <article id={p.id} className="flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-[#e8e1d2] bg-white shadow-sm dark:border-[#22365a] dark:bg-[#13223b]">
      {/* Placeholder: owner ki asli tasveer aane tak. Koi stock photo nahi. */}
      <div role="img" aria-label={p.photoAltUrdu} data-photo-placeholder className="flex aspect-[16/9] flex-col items-center justify-center gap-1 bg-[#f3efe4] text-[#8a7f66] dark:bg-[#0f1c31] dark:text-[#7f93b2]">
        <ImageIcon className="h-8 w-8" aria-hidden />
        <span className="text-xs font-semibold">Asli tasveer jald · Photo coming soon</span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-extrabold text-[#1d2a3a] dark:text-[#eef2f8]">{p.nameRoman}</h3>
        <Ur as="div" className="text-lg font-bold text-[#1f6f4a] dark:text-[#4fc28a]">{p.nameUrdu}</Ur>
        <div className="mt-3 space-y-1">
          {p.offers.map((o) => (
            <div key={o.city} className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#1f6f4a] dark:text-[#4fc28a]">{rs(o.price)}</span>
              <span className="text-sm font-semibold text-[#a77a1f] dark:text-[#e0b45a]">{o.unitText}</span>
              {o.city !== "Pakistan" && <span className="text-sm text-[#5b6675] dark:text-[#9fb0c8]">· {o.city}</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-[#5b6675] dark:text-[#9fb0c8]">{p.descRoman}</p>
        <Ur className="mt-1 text-[15px] text-[#3c4756] dark:text-[#c4d0e2]">{p.descUrdu}</Ur>
        <div className="mt-auto pt-4">
          <WhatsAppButton text={`Assalam o Alaikum, mujhe ${p.nameRoman} ka order dena hai.`} label={`${p.nameRoman} order karein`} />
        </div>
      </div>
    </article>
  );
}
