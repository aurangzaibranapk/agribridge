import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanLine, Bot, PencilLine, ChevronRight } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { AskAiButton } from "./ask-ai-button";

export const dynamic = "force-dynamic";

/**
 * "Nayi Kharid" -- ek darwaza (malik ka naqsha, 4 September).
 *
 * Teenon raaste pehle se bane hue the, magar teen alag safhon par:
 * bill ki tasveer `/admin/products/bill-rates`, haath se likhna
 * `/admin/purchases`, aur AI se kehna Work Coach mein. Naye bande ko
 * pata hi nahi chalta tha ke shuru kahan se ho -- aur jise pata nahi
 * chalta wo hamesha wohi raasta chunta hai jo usay pehle dikh jaye,
 * chahe wo sab se lamba ho.
 *
 * Ye safha koi naya kaam nahi karta: sirf teenon darwaze ek jagah rakh
 * deta hai, aur wohi dikhata hai jo is bande ko khulte hain.
 */

export default async function NewPurchasePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");

  const nav = await loadNav(user.id, me.role, lang);
  const can = (route: string) => nav.unrestricted || routeAllowed(nav.allowedRoutes, route);

  const routes = [
    {
      key: "bill",
      href: "/admin/products/bill-rates",
      allowed: can("/admin/products/bill-rates"),
      icon: ScanLine,
      title: t("np_bill_title", lang),
      desc: t("np_bill_desc", lang),
      hint: t("np_bill_hint", lang),
      primary: true,
    },
    {
      key: "manual",
      href: "/admin/purchases",
      allowed: can("/admin/purchases"),
      icon: PencilLine,
      title: t("np_manual_title", lang),
      desc: t("np_manual_desc", lang),
      hint: t("np_manual_hint", lang),
      primary: false,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[900px]">
      <PageHeader title={t("np_title", lang)} description={t("np_desc", lang)} />

      <div className="space-y-3">
        {routes.map((r) =>
          r.allowed ? (
            <Link
              key={r.key}
              href={r.href}
              className={`flex items-start gap-4 rounded-card border bg-white p-5 transition hover:shadow-md dark:bg-surface-900 ${
                r.primary
                  ? "border-brand-300 hover:border-brand-500 dark:border-brand-800"
                  : "border-surface-200 hover:border-brand-300 dark:border-surface-800"
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <r.icon className="h-[22px] w-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{r.title}</span>
                  {r.primary && (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {t("np_fastest", lang)}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[13px] text-surface-600 dark:text-surface-300">{r.desc}</span>
                <span className="mt-1.5 block text-[12px] text-surface-400">{r.hint}</span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-surface-300" />
            </Link>
          ) : null
        )}

        {/* AI wala raasta koi safha nahi -- wohi panel hai jo har safhe
            par hai. Is liye button, link nahi. */}
        <AskAiButton lang={lang} />
      </div>

      <Card className="mt-4">
        <p className="text-[13px] leading-relaxed text-surface-600 dark:text-surface-300">
          <Bot className="mr-1.5 inline h-4 w-4 text-brand-600" />
          {t("np_note", lang)}
        </p>
      </Card>
    </div>
  );
}
