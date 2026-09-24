import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { CrmClient } from "@/app/admin/crm/crm-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { scoreDb } from "@/lib/score/read";

export const dynamic = "force-dynamic";

export default async function AdminCrmPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));

  const [
    { data: customers },
    { data: suppliers },
    { data: companies },
    { data: dealers },
    { data: rawScores },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, contact_person, phone_number, cnic, email, address, credit_limit, payment_due_days, current_balance, is_active, customer_type, business_name")
      .eq("is_deleted", false)
      .order("name"),
    supabase.from("suppliers").select("id, name, contact_person, phone_number, current_payable").eq("is_active", true).order("name"),
    supabase.from("companies").select("id, name, contact_person, phone_number").order("name"),
    supabase.from("dealers").select("id, business_name, district, verification_status, current_payable").order("business_name"),
    // Score sirf admin/owner ko dikhta hai -- scoreDb visibility fn_score_visible se control hoti hai.
    sabKuchWala
      ? scoreDb(supabase)
          .from("score_snapshots")
          .select("subject_id, score, band, state, evidence_coverage")
          .eq("subject_type", "customer")
          .order("snapshot_date", { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [] }),
  ]);

  // Latest snapshot per customer (snapshot_date desc se pehli entry)
  const scoreMap = new Map<string, { score: number | null; band: string | null; state: string; coverage: number | null }>();
  for (const r of (rawScores ?? []) as { subject_id: string; score: number | null; band: string | null; state: string; evidence_coverage: number | null }[]) {
    if (!scoreMap.has(r.subject_id)) {
      scoreMap.set(r.subject_id, { score: r.score, band: r.band, state: r.state, coverage: r.evidence_coverage });
    }
  }

  return (
    <div>
      <PageHeader
        title={t("cr_title", lang)}
        description="Customers, Suppliers, Companies, and Dealers in one place"
        actions={
          sabKuchWala ? (
            <Link href="/admin/crm/import" className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800">
              Purane Customers Import
            </Link>
          ) : undefined
        }
      />
      <CrmClient
        customers={((customers ?? []) as any[]).map((c) => ({
          ...c,
          current_balance: Number(c.current_balance),
          credit_limit: Number(c.credit_limit),
          payment_due_days: Number(c.payment_due_days),
          score: scoreMap.get(c.id) ?? null,
        }))}
        suppliers={(suppliers ?? []).map((s) => ({ ...s, current_payable: Number(s.current_payable) }))}
        companies={companies ?? []}
        dealers={(dealers ?? []).map((d) => ({ ...d, current_payable: Number(d.current_payable) }))}
      />
    </div>
  );
}