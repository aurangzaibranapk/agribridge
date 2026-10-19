import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { LangProvider } from "@/lib/i18n/lang-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { parseProfile } from "@/lib/portal/customer";
import { CustomerMobileNav, CustomerSidebar } from "./customer-sidebar";

/**
 * Customer Portal ka dhancha (Phase 5) -- sirf un logins ke liye jo kisan nahi
 * magar gahak hain. Kisan ka portal (layout ka baqi hissa) bilkul wesa hi hai.
 */
export async function CustomerShell({ userId, children }: { userId: string; children: React.ReactNode }) {
  const sb = createClient();
  const rpc = sb.rpc.bind(sb) as unknown as (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown }>;
  const [{ data: raw }, { data: prof }] = await Promise.all([
    rpc("fn_my_customer_profile", {}),
    sb.from("profiles").select("role, full_name").eq("id", userId).maybeSingle(),
  ]);
  const p = parseProfile(raw);
  if (!p && prof?.role !== "customer") redirect("/login");
  const lang = getLanguageFromCookies("rm");
  const c = p?.customers[0];
  const name = c?.name ?? prof?.full_name ?? "";
  return (
    <LangProvider lang={lang}>
      <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex min-h-screen bg-[#f4f6fb] dark:bg-[#0a1530]">
        <CustomerSidebar lang={lang} />
        <div className="min-w-0 flex-1">
          <header className="print:hidden flex items-center justify-between border-b border-surface-200 bg-white px-4 py-3 sm:px-6 dark:border-[#1e3160] dark:bg-[#0b1a3a]">
            <div className="flex items-center gap-2">
              <CustomerMobileNav lang={lang} />
              <p className="font-display text-sm font-medium text-surface-900 dark:text-white sm:hidden">{t("pc_portal", lang)}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <ThemeToggle />
              <div className="text-right">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">{name}</p>
                <p className="text-xs text-surface-400">{c ? `${c.code}${c.branch ? ` · ${c.branch}` : ""}` : ""}</p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white">
                {name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "C"}
              </div>
            </div>
          </header>
          <main>
            {p ? children : (
              <div className="mx-auto max-w-xl px-4 py-16 text-center">
                <div className="text-5xl">🧾</div>
                <p className="mt-3 font-semibold text-surface-800 dark:text-slate-100">{t("pc_no_customer", lang)}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </LangProvider>
  );
}
