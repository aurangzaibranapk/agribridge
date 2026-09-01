import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { AiSuggestionsClient } from "./ai-suggestions-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const HQ_ROLES = ["super_admin", "admin", "owner"];

export default async function AiSuggestionsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role, branch_id").eq("id", user.id).maybeSingle() : { data: null };
  const role = profile?.role ?? null;
  const myBranchId = profile?.branch_id ?? null;
  const canDecide = HQ_ROLES.includes(role ?? "") || role === "procurement";

  let query = supabase
    .from("ai_purchase_suggestions")
    .select("*, branches(name), products(name, pack_size)")
    .order("created_at", { ascending: false })
    .limit(100);

  // Branch staff only see suggestions for their own branch (so they can
  // comment on whether it's actually needed); HQ/Procurement see all.
  if (!canDecide && myBranchId) {
    query = query.eq("branch_id", myBranchId);
  }

  const { data: rawSuggestions } = await query;

  const suggestions = (rawSuggestions ?? []).map((s: any) => ({
    id: s.id,
    branch_name: Array.isArray(s.branches) ? s.branches[0]?.name : s.branches?.name,
    product_name: Array.isArray(s.products) ? s.products[0]?.name : s.products?.name,
    pack_size: Array.isArray(s.products) ? s.products[0]?.pack_size : s.products?.pack_size,
    suggested_qty: Number(s.suggested_qty),
    reason: s.reason,
    status: s.status,
    rejection_reason: s.rejection_reason,
    branch_comment: s.branch_comment,
    created_at: s.created_at,
  }));

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <div>
      <PageHeader title={t("at_ai_purchase", lang)} description="AI ne kya suggest kiya hai - review karein" />

      <div className="mb-6">
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{t("at_pending_suggestions", lang)}</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-800 dark:text-brand-200">{pendingCount}</p>
        </Card>
      </div>

      <AiSuggestionsClient suggestions={suggestions} canDecide={canDecide} />
    </div>
  );
}