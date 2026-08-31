import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ScanButton, ReviewForm } from "./anomaly-client";
import { openAnomalies, reviewedAnomalies, MIN_SAMPLE } from "@/lib/ledger/anomalies";
import { CheckCircle2, Bell, Info } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "finance"];
const CAN_REVIEW = ["owner", "super_admin", "admin", "finance"];

const SEVERITY_ORDER = ["high", "medium", "low"];
const SEVERITY_LABEL: Record<string, string> = {
  high: "Mazboot tarteeb",
  medium: "Tarteeb nazar aa rahi hai",
  low: "Halki si baat",
};

export default async function AnomaliesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">{t("lk_named_page", lang)}</div>
    );
  }

  const canReview = CAN_REVIEW.includes(me.role);
  const [open, reviewed] = await Promise.all([openAnomalies(40), reviewedAnomalies(20)]);

  const grouped = SEVERITY_ORDER.map((s) => ({
    severity: s,
    label: SEVERITY_LABEL[s],
    rows: open.filter((a) => a.severity === s),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("an_title", lang)}
        description="Wo cheez jo koi usool nahi torti, magar tarteeb torti hai."
        actions={<ScanButton />}
      />

      {/* ---- Ye safha kya hai aur kya nahi ---- */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-surface-500" />
          <div className="space-y-1.5 text-xs text-surface-600 dark:text-surface-400">
            <p>{t("an_other_pages", lang)}<strong>{t("an_broke_rule", lang)}</strong>. Ye safha wo dekhta hai
              jahan har usool poora hua aur phir bhi kuch ajeeb hai — jaise wo branch jahan cash ka farq{" "}
              <em>{t("an_always", lang)}</em> kam nikalta ho, kabhi zyada nahi. Ginti ki ghalti ittefaqi hoti hai; jo
              cheez hamesha ek hi taraf jhukti ho, wo ittefaq nahi rehti.
            </p>
            <p>
              <strong>{t("an_no_ai", lang)}</strong> Ye safha naam le kar baat karta hai, aur aisi
              baat ka har lafz kisi khane se nikalna chahiye aur dobara ginne par wohi nikalna chahiye. AI
              ka jawab har dafa thora mukhtalif aata hai aur wajah poori nahi milti — yani jis shakhs par
              baat ho, us ko jawab dene ka mauqa hi na mile. Neeche har baat ke sath us ke aankre maujood
              hain.
            </p>
            <p>
              <strong>{t("an_not_accusation", lang)}</strong> Aur namoona {MIN_SAMPLE} se kam ho to kuch kaha
              hi nahi jata — kam data par baat karna sab se aasan aur sab se ghalat hai.
            </p>
          </div>
        </div>
      </Card>

      {open.length === 0 ? (
        <Card className="border-l-4 border-l-green-500 p-4">
          <p className="flex items-start gap-2 text-sm text-green-800 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("an_none", lang)}<span className="mt-0.5 block text-xs font-normal text-surface-600 dark:text-surface-400">
                Is ka matlab do mein se ek hai: ya sab theek hai, ya abhi itna data nahi ke koi tarteeb
                ban sake. Naya system hone ki soorat mein doosri baat zyada mumkin hai.
              </span>
            </span>
          </p>
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.severity}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
              {group.label} ({group.rows.length})
            </h2>
            <div className="space-y-2">
              {group.rows.map((a) => (
                <Card
                  key={a.id}
                  className={`p-4 ${
                    a.severity === "high"
                      ? "border-l-4 border-l-red-500"
                      : a.severity === "medium"
                        ? "border-l-4 border-l-amber-500"
                        : "border-l-4 border-l-surface-300 dark:border-l-surface-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{a.title}</p>
                      <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">{a.detail}</p>

                      {/* ---- Saboot ---- */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(a.evidence).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-md border border-surface-200 px-2 py-0.5 text-xs dark:border-surface-800"
                          >
                            <span className="text-surface-500">{key.replace(/_/g, " ")}</span>
                            <span className="ml-1 font-medium text-surface-900 dark:text-white">
                              {String(value)}
                            </span>
                          </span>
                        ))}
                      </div>

                      <p className="mt-2 text-xs text-surface-400">
                        {a.sampleSize} aankron par gina gaya • {a.detectedOn}
                      </p>

                      {canReview && <ReviewForm anomalyId={a.id} />}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ---- Jo dekhi ja chuki ---- */}
      {reviewed.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">{t("an_seen", lang)}</h2>
            <p className="mt-0.5 text-xs text-surface-500">
              &quot;Wajah maqool thi&quot; aur &quot;masla tha&quot; alag rakhe jate hain — warna ye kabhi
              maloom nahi ho sakta ke ye jaanch kaam ki hai ya sirf shor.
            </p>
          </div>
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {reviewed.map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-surface-800 dark:text-surface-200">{a.title}</p>
                    {a.reviewNote && (
                      <p className="mt-0.5 text-xs text-surface-500">{a.reviewNote}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                      a.status === "confirmed"
                        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                        : "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400"
                    }`}
                  >
                    {a.status === "confirmed" ? "masla tha" : "wajah maqool thi"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
