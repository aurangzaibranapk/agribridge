import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Counter par wapas jane ka raasta.
 *
 * Malik ka kehna (6 September): *"ordering se agar wapas POS par jana ho
 * to option hi nahi hai."*
 *
 * Baat chhoti lagti hai magar counter par nahi hoti: gahak saamne khaRa
 * hota hai, banda ordering ka safha khol chuka hota hai, aur wapas jane
 * ka koi khana nazar nahi aata. Us waqt wo browser ka teer dhoondhta hai
 * ya poora menu khol kar POS talash karta hai -- aur ye har dafa hota
 * hai, din mein kai baar.
 *
 * Har us safhe par jo POS ke andar se khulta hai, wapas jane ka raasta
 * SAAMNE hona chahiye. Jo darwaza khula ho, us ka wapas ka rasta bhi
 * dikhna chahiye.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 transition hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
