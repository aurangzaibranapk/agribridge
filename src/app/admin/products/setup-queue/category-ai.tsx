"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Sparkles, Check } from "lucide-react";
import {
  suggestCategories,
  applyCategorySuggestions,
  type SuggestState,
} from "@/actions/category-suggest";

const initial: SuggestState = {};

/**
 * "AI tajweez de, hum OK karein."
 *
 * Malik ka kehna (5 September): *"jo jo products bahar hain... us ko hum
 * command dein to wo un products ka, jo un ki category banti hai, us
 * mein move ka DRAFT banaye -- phir hum check kar ke us ko OK karein."*
 *
 * Do alag form, jaan boojh kar. Pehla sirf poochta hai; doosra hi kuch
 * badalta hai. AI ka natija seedha darj nahi hota -- beech mein banda
 * khara hai.
 *
 * "Shayad" wali qatar par nishan KHUD SE nahi lagta. Andaze ko yaqeen ki
 * tarah pesh karna aur us par nishan pehle se laga dena ek hi baat hai
 * -- banda tez tezi mein "Manzoor" daba deta hai aur andaza pakka ban
 * jata hai.
 */
export function CategoryAi() {
  const [draft, draftAction] = useFormState(suggestCategories, initial);
  const [applied, applyAction] = useFormState(applyCategorySuggestions, initial);

  return (
    <div className="mb-5 rounded-card border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-brand-600" /> AI se qism ki tajweez
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
            AI har cheez ki munasib qism aur poora naam tajweez karega. <strong>Wo khud kuch darj nahi
            karega</strong> — naam wahi rahega jo abhi hai, jab tak aap khud na badlein.
          </p>
        </div>
        <form action={draftAction}>
          <DraftButton />
        </form>
      </div>

      {draft.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {draft.error}
        </p>
      )}
      {applied.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {applied.error}
        </p>
      )}
      {applied.notice && (
        <p className="mt-3 rounded-lg bg-brand-100 px-3 py-2 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
          {applied.notice} — safha refresh karein.
        </p>
      )}
      {draft.notice && !draft.tajaweez && (
        <p className="mt-3 rounded-lg bg-surface-100 px-3 py-2 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
          {draft.notice}
        </p>
      )}

      {draft.tajaweez && draft.tajaweez.length > 0 && (
        <form action={applyAction} className="mt-4">
          <p className="mb-2 text-xs text-surface-600 dark:text-surface-400">{draft.notice}</p>

          <div className="max-h-[420px] overflow-auto rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-surface-50 dark:bg-surface-800">
                <tr className="border-b border-surface-200 text-left dark:border-surface-700">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Cheez ka naam
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Stock</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Tajweez shuda qism</th>
                </tr>
              </thead>
              <tbody>
                {draft.tajaweez.map((t) => (
                  <tr
                    key={t.productId}
                    className="border-b border-surface-100 last:border-0 dark:border-surface-800"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        name="chuna"
                        value={t.productId}
                        // "Pakka" par nishan pehle se; "shayad" par nahi.
                        defaultChecked={t.yaqeen === "pakka"}
                        className="h-4 w-4 rounded border-surface-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <NaamKhana
                        productId={t.productId}
                        purana={t.productName}
                        tajweez={t.tajweezNaam}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                      {t.stock > 0 ? t.stock : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {/* AI ki tajweez pehle se chuni hui hai, magar
                          badli ja sakti hai. Malik ka kehna (5 Sept):
                          "Mooli hai -- agar editing ka option hota to
                          main edit kar ke OK kar deta." AI ne Mooli par
                          "Vegetable Seeds (shayad)" likha tha; us ka
                          shak theek tha, magar us ke aage ka raasta band
                          tha -- ya ghalat tajweez manzoor karo, ya qatar
                          chhor do. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          name={`qism__${t.productId}`}
                          defaultValue={t.categoryId}
                          className="h-8 max-w-[220px] rounded-md border border-surface-200 bg-white px-2 text-xs text-surface-900 outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
                        >
                          {(draft.qismein ?? [{ id: t.categoryId, name: t.categoryName }]).map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.name}
                            </option>
                          ))}
                        </select>
                        {t.yaqeen === "shayad" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            shayad
                          </span>
                        )}
                      </div>
                      {t.wajah && <p className="mt-0.5 text-[11px] text-surface-500">{t.wajah}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <ApplyButton />
            <p className="text-xs text-surface-500">
              Sirf jin par nishan hai wohi darj hongi — aur wohi qism jo dropdown mein dikh rahi hai.
              &ldquo;Shayad&rdquo; wali qatarein khud se nahi chuni gayin.
            </p>
          </div>
        </form>
      )}

      {/* Jin par AI kuch tay na kar saka. Inhen chhupa dena "sab ho gaya"
          ka jhoota tassur deta hai. */}
      {draft.naMaloom && draft.naMaloom.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            {draft.naMaloom.length} cheezon par AI kuch tay nahi kar saka — in ki qism haath se lagani paRegi:
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
            {draft.naMaloom.slice(0, 20).map((n) => n.productName).join(", ")}
            {draft.naMaloom.length > 20 ? " …" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Naam ka khana -- darj shuda naam, aur sath AI ki tajweez.
 *
 * Malik ka kehna (5 September): *"jo naam likha hai, sath AI recommend
 * kare. Agar theek to OK, warna edit kar ke naya likh dein. **Pehla wala
 * jo hai wo hona chahiye jab tak change na karein.**"*
 *
 * Isi liye khane mein PURANA naam hota hai, AI ka nahi. AI ki tajweez
 * neeche ek chip par likhi aati hai -- dabane se khane mein aa jati hai,
 * na dabayein to naam waisa ka waisa rehta hai.
 *
 * Ye farq ahem hai: "Rin" counter par kaam ka naam hai, aur wohi naam
 * hai jis se malik apna maal pehchante hain. Usay chup chaap "Rin
 * Washing Powder" bana dena us pehchaan ko le uRta hai.
 */
function NaamKhana({
  productId,
  purana,
  tajweez,
}: {
  productId: string;
  purana: string;
  tajweez: string | null;
}) {
  const [naam, setNaam] = useState(purana);

  return (
    <div>
      {/* Purana naam sath jata hai taake server bata sake ke waqai kuch
          badla ya nahi -- bina us ke har qatar "badal gayi" lagti. */}
      <input type="hidden" name={`purana__${productId}`} value={purana} />
      <input
        name={`naam__${productId}`}
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        className="h-8 w-full min-w-[160px] rounded-md border border-surface-200 bg-white px-2 text-sm text-surface-900 outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
      />
      {tajweez && naam !== tajweez && (
        <button
          type="button"
          onClick={() => setNaam(tajweez)}
          title="Ye naam khane mein daalein"
          className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-800 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-200"
        >
          <Sparkles className="h-3 w-3" /> {tajweez}
        </button>
      )}
      {tajweez && naam === tajweez && naam !== purana && (
        <button
          type="button"
          onClick={() => setNaam(purana)}
          className="mt-1 text-[11px] text-surface-400 hover:text-surface-600"
        >
          purana naam wapas ({purana})
        </button>
      )}
    </div>
  );
}

function DraftButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
    >
      <Sparkles className="h-4 w-4" />
      {pending ? "AI soch raha hai…" : "AI se tajweez lein"}
    </button>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
    >
      <Check className="h-4 w-4" />
      {pending ? "…" : "Manzoor karein — qism darj karein"}
    </button>
  );
}
