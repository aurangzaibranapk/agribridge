import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadInbox, filterInbox, INBOX_LABELS, type InboxSource } from "@/lib/access/inbox";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { Inbox as InboxIcon } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * AgriBridge Inbox — bahar se aane wala kaam, ek darwaze par.
 *
 * Malik ka naqsha (5 September): har channel (WhatsApp, website,
 * marketplace, AI, staff) ka kaam usi ek ERP mein jaye, aur bande ko ye
 * na sochna paRe ke module kaunsa hai.
 *
 * Us naqshe ka bara hissa pehle se bana hua tha: Command Center, Mera
 * Kaam, department workspaces, approvals, audit. Jo cheez WAQAI nahi
 * thi wo yehi ek darwaza hai. Aaj bahar ka kaam CHHE alag jaghon par
 * girta hai aur har ek apna safha khulne ka intezar karta hai. Jo safha
 * kisi ne aaj nahi khola, us mein para kaam kisi ko nazar nahi aaya --
 * aur "kisi ko nazar nahi aaya" is project ka sab se mehnga masla hai.
 *
 * Yahan koi naya nizam nahi bana. Ek bhi nayi table nahi. Qatarein wohi
 * hain jo pehle se apni apni jagah pari hain; ye safha unhen ek sath
 * dikhata hai aur har ek ko US SAFHE par bhej deta hai jahan us ka kaam
 * hota hai. Faisla, manzoori aur audit wahin ke wahin -- yahan sirf
 * dekhna aur pahunchna hai.
 */
export default async function InboxPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");

  const nav = await loadNav(user.id, me.role, lang);
  // Owner/Admin par koi rok nahi; baqi ko sirf wohi qatarein jin ka
  // safha un par khulta hai. Band darwaze ka kaam dikhana waqt bhi zaya
  // karta hai aur bharosa bhi.
  const allowedRoutes = nav.unrestricted ? null : nav.allowedRoutes;

  const { items: sab, naKhule } = await loadInbox();
  const items = filterInbox(sab, allowedRoutes);

  const ginti = new Map<InboxSource, number>();
  for (const i of items) ginti.set(i.source, (ginti.get(i.source) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title="AgriBridge Inbox"
        description="Bahar se aane wala kaam — WhatsApp, website, marketplace, AI aur ijazat — ek jagah."
      />

      {/* Jo source parha hi nahi ja saka. Us ki jagah sifar likhna jhoot
          hota: "kuch nahi aaya" aur "dekha hi nahi ja saka" ek cheez
          nahi. */}
      {naKhule.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {naKhule.map((s) => INBOX_LABELS[s]).join(", ")} is waqt parha nahi ja saka — us ka kaam is fehrist mein
          shaamil <strong>nahi</strong> hai. (Ye &ldquo;kuch nahi aaya&rdquo; ka matlab nahi.)
        </Card>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {(Object.keys(INBOX_LABELS) as InboxSource[]).map((s) => {
          const n = ginti.get(s) ?? 0;
          const naKhula = naKhule.includes(s);
          return (
            <span
              key={s}
              className={
                naKhula
                  ? "rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                  : n > 0
                    ? "rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200"
                    : "rounded-lg border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-surface-500 dark:border-surface-800 dark:bg-surface-900"
              }
            >
              {INBOX_LABELS[s]} · {naKhula ? "—" : n}
            </span>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <InboxIcon className="mx-auto h-8 w-8 text-surface-300" />
            <p className="mt-3 text-sm font-medium text-surface-700 dark:text-surface-300">
              Is waqt bahar se koi kaam nahi aaya.
            </p>
            <p className="mt-1 text-xs text-surface-500">
              WhatsApp, website, marketplace, AI ka draft aur ijazat ki darkhwast — sab dekh liye gaye.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {items.map((i) => (
              <li key={i.id}>
                <Link
                  href={i.raasta}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50"
                >
                  <span
                    className={
                      "mt-1 h-2 w-2 shrink-0 rounded-full " +
                      (i.tone === "red"
                        ? "bg-red-500"
                        : i.tone === "amber"
                          ? "bg-amber-500"
                          : i.tone === "blue"
                            ? "bg-blue-500"
                            : "bg-surface-300")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[11px] font-medium text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                        {INBOX_LABELS[i.source]}
                      </span>
                      {i.kisNe && (
                        <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{i.kisNe}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-surface-700 dark:text-surface-300">{i.kya}</p>
                    {i.tafseel && <p className="mt-0.5 text-xs text-surface-500">{i.tafseel}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-surface-400">
                    {new Date(i.kab).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-surface-500">
        Ye safha sirf dikhata aur pahunchata hai. Har faisla, manzoori aur audit apne apne safhe par hota hai —
        wahi purane qaide, wahi rok.
      </p>
    </div>
  );
}
