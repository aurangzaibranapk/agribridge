import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin"];

/**
 * AI ka khata -- kitna istemal hua.
 *
 * Malik ka sawal (5 September): *"itna AI involve kiya hai, kya is ka
 * bill aayega?"* Us waqt ye sawal jawab nahi paa sakta tha: sirf chat
 * panel ka indraj hota tha, baqi kuch nahi.
 *
 * Ye safha PAISA NAHI GINTA. Qeemat Google tay karta hai, wo badalti
 * rehti hai, aur har chaabi ke saamne alag hoti hai -- yahan koi adad
 * likh dena andaza hota, aur andaze ko hisaab ki tarah pesh karna is
 * project mein bar bar mehnga paRa hai.
 *
 * Ye sirf ISTEMAL batata hai: kitni dafa, kis feature se, kitni
 * tasveerein, kitne token. Bill Google ke apne safhe par dekha jata hai
 * -- magar us se pehle yahan se pata chal jata hai ke kya chal raha hai.
 */
export default async function AiUsagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title="AI ka khata" />
        <Card>
          <p className="text-sm text-surface-600">Ye safha sirf Owner ya Admin ke liye hai.</p>
        </Card>
      </div>
    );
  }

  const service = createServiceClient();
  const mahinaShuru = new Date();
  mahinaShuru.setDate(1);
  mahinaShuru.setHours(0, 0, 0, 0);

  const { data: rows, error } = await service
    .from("ai_usage_log")
    .select("feature, kind, ok, images, total_tokens, created_at")
    .gte("created_at", mahinaShuru.toISOString())
    .limit(5000);

  // Khata na khule to sifar dikhana jhoot hai -- "kuch nahi hua" aur
  // "dekha nahi ja saka" ek cheez nahi.
  if (error) {
    return (
      <div>
        <PageHeader title="AI ka khata" description="Is mahine kitna AI istemal hua" />
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Khata is waqt parha nahi ja saka: {error.message}
          </p>
        </Card>
      </div>
    );
  }

  const list = rows ?? [];
  const kulCalls = list.length;
  const nakaam = list.filter((r) => !r.ok).length;
  const tasveerein = list.reduce((s, r) => s + Number(r.images ?? 0), 0);

  // Token sab qataron par nahi milte. Jama sirf un ka hai jin par mile,
  // aur ye bhi likha jata hai ke kitni qataron par nahi mile.
  const tokenWale = list.filter((r) => r.total_tokens != null);
  const kulToken = tokenWale.reduce((s, r) => s + Number(r.total_tokens), 0);
  const tokenNaMile = kulCalls - tokenWale.length;

  const byFeature = new Map<string, { kul: number; nakaam: number; tasveer: number; token: number }>();
  for (const r of list) {
    const k = String(r.feature);
    const cur = byFeature.get(k) ?? { kul: 0, nakaam: 0, tasveer: 0, token: 0 };
    cur.kul += 1;
    if (!r.ok) cur.nakaam += 1;
    cur.tasveer += Number(r.images ?? 0);
    cur.token += Number(r.total_tokens ?? 0);
    byFeature.set(k, cur);
  }
  const features = [...byFeature.entries()].sort((a, b) => b[1].kul - a[1].kul);

  const mahinaNaam = mahinaShuru.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="AI ka khata"
        description={`${mahinaNaam} mein kitna AI istemal hua — har feature alag`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="AI se baat" value={String(kulCalls)} />
        <Tile label="Tasveerein bani" value={String(tasveerein)} tone={tasveerein > 0 ? "amber" : undefined} />
        <Tile label="Token (jahan ginti mili)" value={kulToken > 0 ? kulToken.toLocaleString() : "—"} />
        <Tile label="Nakaam koshishein" value={String(nakaam)} tone={nakaam > 0 ? "red" : undefined} />
      </div>

      {tokenNaMile > 0 && (
        <p className="mb-4 text-xs text-surface-500">
          {tokenNaMile} qataron par token ki ginti nahi mili — un ka jama upar shaamil <strong>nahi</strong> hai.
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Feature</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Dafa</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Tasveerein</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Token</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Nakaam</th>
            </tr>
          </thead>
          <tbody>
            {features.map(([f, v]) => (
              <tr key={f} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{f}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v.kul}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v.tasveer > 0 ? v.tasveer : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v.token > 0 ? v.token.toLocaleString() : "—"}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${v.nakaam > 0 ? "text-red-600" : "text-surface-400"}`}>
                  {v.nakaam > 0 ? v.nakaam : "—"}
                </td>
              </tr>
            ))}
            {features.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-surface-400">
                  Is mahine abhi tak AI istemal nahi hua.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Card className="mt-4 border-surface-200 dark:border-surface-800">
        <p className="flex items-center gap-2 text-sm font-medium text-surface-800 dark:text-surface-200">
          <Sparkles className="h-4 w-4 text-brand-600" /> Ye safha paisa nahi ginta
        </p>
        <p className="mt-1 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
          Qeemat Google tay karta hai, wo badalti rehti hai, aur har chaabi ke saamne alag hoti hai — yahan koi
          rupya likh dena andaza hota. Ye sirf <strong>istemal</strong> batata hai. Asal bill{" "}
          <strong>Google Cloud Console → Billing</strong> par dikhta hai; wahin{" "}
          <strong>Budgets &amp; alerts</strong> mein ek hadd laga dein, to hadd se aage barhne par Google khud email
          kar dega.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
          Yaad rakhein: <strong>likhai sasti hai, tasveer mehngi.</strong> Isi liye ek dafa mein 15 se zyada
          tasveerein nahi banti.
        </p>
      </Card>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" }) {
  const colour =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-surface-900 dark:text-white";
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${colour}`}>{value}</p>
    </Card>
  );
}
