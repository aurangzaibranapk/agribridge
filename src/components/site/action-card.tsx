import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * "Aap kya karna chahte hain" wala khana.
 *
 * Ye HAMESHA ek Link hai, kabhi khali card nahi. Spec ka usool yehi hai:
 * koi `href="#"`, koi mara hua button nahi -- har khana kisi asal jagah
 * par le kar jata hai. Is liye `href` yahan lazmi hai; jis cheez ki
 * jagah abhi bani hi nahi, us ka card banta hi nahi.
 */
export function ActionCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-surface-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#1E4A2E]/30 hover:shadow-lg dark:border-surface-800 dark:bg-surface-900"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E4A2E]/[0.07] text-[#1E4A2E] dark:bg-brand-900/30 dark:text-brand-400">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 grow text-sm leading-6 text-surface-600 dark:text-surface-400">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1E4A2E] dark:text-brand-400">
        Dekhein
        {/* Safha Urdu/RTL bhi ho sakta hai, is liye teer ANDAR ki taraf
            (start) rakha gaya hai aur hover par wahin sarakta hai. */}
        <ChevronLeft className="h-4 w-4 rotate-180 transition group-hover:translate-x-1 rtl:rotate-0 rtl:group-hover:-translate-x-1" />
      </span>
    </Link>
  );
}
