"use client";
import { useEffect } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

/**
 * Jab kisi admin safhe par kuch toot jaye.
 *
 * Is ke baghair Next apna safha dikhata hai: khali sufaid screen aur ek
 * jumla -- "Application error: a client-side exception has occurred (see
 * the browser console for more information)". Us jumle se koi kaam nahi
 * banta. Malik ko F12 daba kar console kholna parta hai, us mein se laal
 * lakeer dhoondhni parti hai, aur us ki tasveer bhejni parti hai -- aur
 * tab tak wo safha band kar chuka hota hai.
 *
 * Ab wajah SAFHE PAR likhi aati hai, aur us ke sath ek `digest` bhi --
 * wo chhota sa code server ke log mein bhi wahi hota hai, is liye usi se
 * asal khata dhoondha ja sakta hai chahe paighaam adhoora ho.
 *
 * Ye kharabi ko theek nahi karta. Ye us ka NAAM saamne laata hai --
 * kyunke jis kharabi ka naam maloom na ho, us par kaam shuru hi nahi
 * hota.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = useLang();
  useEffect(() => {
    // Browser ke console mein bhi -- jahan poora stack milta hai.
    console.error("Admin safhe par kharabi:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-card border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
        <h1 className="font-display text-lg font-semibold text-red-800 dark:text-red-300">{t("at_page_broke", lang)}</h1>
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">{t("at_nothing_lost", lang)}</p>

        <div className="mt-4 rounded-lg border border-red-200 bg-white p-3 dark:border-red-900/40 dark:bg-surface-900">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_reason", lang)}</p>
          <p className="mt-1 break-words font-mono text-xs text-surface-800 dark:text-surface-200">
            {error.message || "Paighaam nahi mila"}
          </p>
          {/* Digest server ke log mein bhi wohi hota hai -- paighaam
              adhoora ho to bhi isi se asal khata mil jata hai. */}
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-surface-500">digest: {error.digest}</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
          >{t("at_try_again", lang)}</button>
          <Link
            href="/admin/my-work"
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
          >{t("at_back_to_my_work", lang)}</Link>
        </div>

        <p className="mt-4 text-xs text-red-700/80 dark:text-red-400/80">
          Ye safha jab bhi aaye, upar likhi &quot;Wajah&quot; aur &quot;digest&quot; ki tasveer bhej dein — usi se
          maloom hota hai ke kya toota.
        </p>
      </div>
    </div>
  );
}
