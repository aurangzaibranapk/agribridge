import type { Metadata } from "next";
import { Mail, MessageCircle, ShieldCheck, Trash2, Archive, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { urduBody } from "@/components/portal/urdu-font";
import {
  DELETION_COPY,
  DELETION_FALLBACK_EMAIL,
  DELETION_FALLBACK_PHONE,
  cleanSetting,
  deletionOrder,
  whatsappDigits,
  type DeletionLang,
} from "@/lib/account-deletion-content";

export const metadata: Metadata = {
  title: "Account Deletion — AgriBridge",
  description:
    "How to delete your AgriBridge (Al Rana Traders) account, what data is deleted and which financial records are kept by law.",
  alternates: { canonical: "/account-deletion" },
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

async function contact() {
  type Row = { key: string; value: unknown };
  let rows: Row[] = [];
  try {
    const supabase = createClient();
    const res = await supabase.from("website_settings").select("key, value").in("key", ["contact_phone", "contact_email"]);
    rows = (res.data ?? []) as Row[];
  } catch (e) {
    console.error("account-deletion: website_settings nahi mile —", e instanceof Error ? e.message : e);
  }
  const get = (k: string): unknown => rows.find((r: Row) => r.key === k)?.value;
  return {
    phone: cleanSetting(get("contact_phone"), DELETION_FALLBACK_PHONE),
    email: cleanSetting(get("contact_email"), DELETION_FALLBACK_EMAIL),
  };
}

export default async function AccountDeletionPage() {
  const cookieLang = getLanguageFromCookies("rm") as DeletionLang;
  const order = deletionOrder(["en", "rm", "ur"].includes(cookieLang) ? cookieLang : "rm");
  const { phone, email } = await contact();
  const wa = whatsappDigits(phone);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <nav aria-label="Language" className="mb-8 flex flex-wrap justify-center gap-2">
        {order.map((l) => (
          <a
            key={l}
            href={`#${l}`}
            lang={l === "ur" ? "ur" : "en"}
            dir={l === "ur" ? "rtl" : undefined}
            style={l === "ur" ? { fontFamily: "var(--font-urdu), system-ui, sans-serif", letterSpacing: 0 } : undefined}
            className={`rounded-full border border-surface-200 px-4 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800 ${l === "ur" ? urduBody.variable : ""}`}
          >
            {DELETION_COPY[l].label}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {order.map((l, i) => {
          const H = i === 0 ? "h1" : "h2";
          const c = DELETION_COPY[l];
          const ur = l === "ur";
          // Urdu: sarkhiyon par Latin display font aur letter-spacing huroof tor deta hai.
          const hs = ur ? { fontFamily: "inherit", letterSpacing: 0 } : undefined;
          const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(c.template)}`;
          const mailHref = `mailto:${email}?subject=${encodeURIComponent("Account deletion request")}&body=${encodeURIComponent(c.template)}`;
          return (
            <section
              key={l}
              id={l}
              lang={ur ? "ur" : "en"}
              dir={ur ? "rtl" : "ltr"}
              data-testid={`deletion-${l}`}
              className={`scroll-mt-24 rounded-2xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-700 dark:bg-surface-900 sm:p-8 ${ur ? urduBody.variable : ""}`}
              style={ur ? { fontFamily: "var(--font-urdu), system-ui, sans-serif", lineHeight: 2 } : undefined}
            >
              <H style={hs} className="flex items-center gap-2 font-display text-2xl font-semibold text-surface-900 dark:text-white">
                <Trash2 className="h-6 w-6 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                {c.title}
              </H>
              <p className="mt-3 text-surface-600 dark:text-surface-300">{c.intro}</p>

              <h2 style={hs} className="mt-6 flex items-center gap-2 text-lg font-semibold text-surface-900 dark:text-white">
                <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden />
                {c.howTitle}
              </h2>
              <ol className="mt-2 list-decimal space-y-1.5 ps-6 text-surface-700 dark:text-surface-200">
                {c.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>

              <div className="mt-4 flex flex-wrap gap-2">
                <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {c.whatsapp}: <span dir="ltr">{phone}</span>
                </a>
                <a href={mailHref} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-surface-200 px-4 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
                  <Mail className="h-4 w-4" aria-hidden />
                  {c.email}: <span dir="ltr">{email}</span>
                </a>
              </div>

              <h2 style={hs} className="mt-6 flex items-center gap-2 text-lg font-semibold text-surface-900 dark:text-white">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
                {c.deletedTitle}
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 ps-6 text-surface-700 dark:text-surface-200">
                {c.deleted.map((s) => <li key={s}>{s}</li>)}
              </ul>

              <h2 style={hs} className="mt-6 flex items-center gap-2 text-lg font-semibold text-surface-900 dark:text-white">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
                {c.keptTitle}
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 ps-6 text-surface-700 dark:text-surface-200">
                {c.kept.map((s) => <li key={s}>{s}</li>)}
              </ul>

              <h2 style={hs} className="mt-6 flex items-center gap-2 text-lg font-semibold text-surface-900 dark:text-white">
                <Clock className="h-5 w-5 text-surface-500 dark:text-surface-400" aria-hidden />
                {c.timeTitle}
              </h2>
              <p className="mt-2 text-surface-700 dark:text-surface-200">{c.time}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
