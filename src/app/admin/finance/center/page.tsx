import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import {
  BookOpen,
  ArrowLeftRight,
  Settings2,
  Building2,
  BarChart3,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

/**
 * Financial Accounting ka markaz.
 *
 * Malik ka naqsha (5 September): paanch group. Ye safha unhi paanch ke
 * neeche wo safhe ikhattha karta hai jo PEHLE SE maujood hain -- naya
 * kuch nahi banata.
 *
 * Aur jo abhi nahi bane, un ki fehrist bhi neeche saaf likhi hai. Ye
 * jaan boojh kar hai: aadhe bane hue nizam mein sab se bura kaam ye hota
 * hai ke na-maujood cheez ka naam menu mein laga diya jaye. Banda us par
 * dabata hai, kuch nahi hota, aur us ke baad wo poore nizam par shak
 * karne lagta hai. Jo nahi hai, us ka saaf kehna us se behtar hai.
 */

interface Item {
  href: string;
  label: string;
  hint?: string;
}

interface Group {
  key: string;
  title: string;
  icon: React.ReactNode;
  tone: string;
  items: Item[];
  /** Jo abhi nahi bane. */
  baqi: string[];
}

export default async function FinanceCenterPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("fc_only_finance", lang)}</div>;
  }

  const groups: Group[] = [
    {
      key: "finance",
      title: t("fc_g1", lang),
      icon: <BookOpen className="h-5 w-5" />,
      tone: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
      items: [
        { href: "/admin/finance/journal-entry", label: t("fc_jv", lang), hint: t("fc_jv_hint", lang) },
        { href: "/admin/finance", label: t("fc_cashbook", lang) },
        { href: "/admin/bank-reconcile", label: t("fc_bank_recon", lang) },
        { href: "/admin/reconciliation", label: t("fc_daily_recon", lang) },
        { href: "/admin/finance/budget", label: t("bg_title", lang), hint: t("bg_desc", lang) },
        { href: "/admin/finance/cheques", label: t("chq_title", lang), hint: t("chq_desc", lang) },
        { href: "/admin/finance/recurring", label: t("rec_title", lang), hint: t("rec_desc", lang) },
        { href: "/admin/finance/costing", label: t("cst_title", lang), hint: t("cst_desc", lang) },
        { href: "/admin/audit-trail", label: t("fc_reversal", lang), hint: t("fc_reversal_hint", lang) },
      ],
      baqi: [],
    },
    {
      key: "pay",
      title: t("fc_g2", lang),
      icon: <ArrowLeftRight className="h-5 w-5" />,
      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      items: [
        { href: "/admin/purchases/bills", label: t("fc_supplier_pay", lang) },
        { href: "/admin/khata", label: t("fc_customer_recover", lang) },
        { href: "/admin/cash-custody", label: t("fc_cash_custody", lang) },
        { href: "/admin/cash-handover", label: t("fc_handover", lang), hint: t("fc_handover_hint", lang) },
        { href: "/admin/cash-close", label: t("fc_cash_close", lang) },
        { href: "/admin/staff-khata", label: t("fc_staff_khata", lang), hint: t("fc_staff_hint", lang) },
      ],
      baqi: [t("fc_b_loan", lang)],
    },
    {
      key: "system",
      title: t("fc_g3", lang),
      icon: <Settings2 className="h-5 w-5" />,
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      items: [
        { href: "/admin/finance/accounts", label: t("coa_title", lang), hint: t("coa_desc", lang) },
        { href: "/admin/finance/periods", label: t("per_title", lang), hint: t("per_desc", lang) },
        { href: "/admin/finance/terms", label: t("pt_title", lang), hint: t("pt_desc", lang) },
        { href: "/admin/finance/banks", label: t("fc_banks", lang) },
        { href: "/admin/finance/payment-mapping", label: t("fc_pay_map", lang), hint: t("fc_pay_map_hint", lang) },
      ],
      baqi: [],
    },
    {
      key: "assets",
      title: t("fc_g4", lang),
      icon: <Building2 className="h-5 w-5" />,
      tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      items: [
        { href: "/admin/finance/assets", label: t("fc_assets_register", lang), hint: t("fc_assets_hint", lang) },
        { href: "/admin/finance/assets/depreciation", label: t("fc_assets_dep", lang) },
        { href: "/admin/finance/assets/categories", label: t("fc_assets_cats", lang) },
      ],
      baqi: [],
    },
    {
      key: "reports",
      title: t("fc_g5", lang),
      icon: <BarChart3 className="h-5 w-5" />,
      tone: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      items: [
        { href: "/admin/finance/reports?view=cashflow", label: t("fr_v_cashflow", lang), hint: t("fr_desc", lang) },
        { href: "/admin/finance/reports?view=working", label: t("fr_v_working", lang) },
        { href: "/admin/finance/reports?view=party", label: t("fr_v_party", lang) },
        { href: "/admin/finance/reports?view=branch", label: t("fr_v_branch", lang) },
        { href: "/admin/finance/ledger", label: t("led_title", lang), hint: t("led_desc", lang) },
        { href: "/admin/finance/statements?view=trial", label: t("fc_trial", lang) },
        { href: "/admin/finance/statements?view=pnl", label: t("fc_pnl", lang) },
        { href: "/admin/finance/statements?view=bs", label: t("fc_bs", lang) },
        { href: "/admin/finance/statements?view=journal", label: t("fc_journal", lang) },
        { href: "/admin/reports/finance", label: t("fc_finance_report", lang) },
        { href: "/admin/reports/pnl", label: t("fc_shop_pnl", lang) },
        { href: "/admin/machinery-rental/pnl", label: t("fc_machinery_pnl", lang) },
        { href: "/admin/reports/credit", label: t("fc_credit_report", lang) },
        { href: "/admin/reports/audit", label: t("fc_audit_report", lang) },
        { href: "/admin/anomalies", label: t("fc_anomalies", lang) },
      ],
      baqi: [],
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("fc_title", lang)} description={t("fc_desc", lang)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${g.tone}`}>{g.icon}</span>
              <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{g.title}</h2>
            </div>

            {g.items.length > 0 && (
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="block rounded-lg px-2.5 py-2 hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <span className="block text-sm font-medium text-surface-800 dark:text-surface-200">{i.label}</span>
                    {i.hint && <span className="block text-xs text-surface-400">{i.hint}</span>}
                  </Link>
                ))}
              </div>
            )}

            {/* Jo abhi nahi bana, us ka saaf likha hona zaroori hai.
                Na-maujood cheez ka naam menu mein laga dene se banda us
                par dabata hai, kuch nahi hota, aur us ke baad wo poore
                nizam par shak karne lagta hai. */}
            {g.baqi.length > 0 && (
              <div className="mt-auto rounded-lg border border-dashed border-surface-200 px-2.5 py-2 dark:border-surface-700">
                <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-surface-400">
                  <Clock className="h-3 w-3" /> {t("fc_pending", lang)}
                </p>
                <p className="mt-0.5 text-xs text-surface-400">{g.baqi.join(" · ")}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="text-xs text-surface-500">
        {/* Ye baat safhe par is liye likhi hai ke accountant ko sab se
            pehle yehi samajhni chahiye: us ka kaam entry TYPE karna nahi,
            entry DEKHNA hai. */}
        {t("fc_architecture", lang)}
      </Card>
    </div>
  );
}
