import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ErrorsClient } from "./errors-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin"];

/**
 * Kharabiyan -- ek safha jahan har masla nazar aata hai.
 *
 * Malik ka kehna (5 September): *"kahin bhi koi error aaye to mujhe pata
 * chal jaye -- code mein ho ya bill duplicating mein, POS ya inventory,
 * kahin bhi -- ek page par pata chal jaye, taake developer usay khatam
 * kar sake."*
 *
 * Pehle kharabi ka pata chalne ka ek hi raasta tha: koi banda screenshot
 * bheje. Jo kharabi kisi ne nahi dekhi, ya dekhi magar batai nahi, wo
 * kabhi theek nahi hoti.
 *
 * Safha do baaton par khara hai:
 *
 *   - **Ek jaisi kharabi ek qatar mein.** Ek hi masla chalees dafa aaya
 *     ho to chalees qatarein nahi, ek qatar aur us par "40 dafa". Warna
 *     safha parhne ke qabil hi nahi rehta -- aur jo safha parha na jaye
 *     wo bhi utna hi bekaar hai jitna koi safha na hona.
 *
 *   - **Hal shuda qatar mitai nahi jati.** Us par nishan lagta hai.
 *     Mita dene se ye sawal kabhi jawab nahi paata ke ye masla pehle bhi
 *     aaya tha ya nahi.
 */
export default async function ErrorsPage({ searchParams }: { searchParams?: { sab?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title="Kharabiyan" />
        <Card>
          <p className="text-sm text-surface-600">Ye safha sirf Owner ya Admin ke liye hai.</p>
        </Card>
      </div>
    );
  }

  const sabDikhayein = searchParams?.sab === "1";

  const { data: rows, error } = await createServiceClient()
    .from("v_error_summary")
    .select("*")
    .order("aakhri_dafa", { ascending: false })
    .limit(300);

  // Khata na khule to "koi kharabi nahi" likhna jhoot hai -- "kuch nahi
  // mila" aur "dekha nahi ja saka" ek cheez nahi.
  if (error) {
    return (
      <div>
        <PageHeader title="Kharabiyan" description="Poore system ki kharabiyan ek jagah" />
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Kharabiyon ka khata is waqt parha nahi ja saka: {error.message}
          </p>
        </Card>
      </div>
    );
  }

  const sab = (rows ?? []).map((r) => ({
    fingerprint: String(r.fingerprint ?? ""),
    module: String(r.module ?? "code"),
    message: String(r.message ?? ""),
    route: (r.route as string | null) ?? null,
    detail: (r.detail as string | null) ?? null,
    digest: (r.digest as string | null) ?? null,
    severity: String(r.severity ?? "ghalti"),
    kitniDafa: Number(r.kitni_dafa ?? 0),
    khuli: Number(r.khuli ?? 0),
    pehliDafa: String(r.pehli_dafa ?? ""),
    aakhriDafa: String(r.aakhri_dafa ?? ""),
  }));

  const khuli = sab.filter((r) => r.khuli > 0);
  const dikhane = sabDikhayein ? sab : khuli;

  return (
    <div>
      <PageHeader
        title="Kharabiyan"
        description="Poore system ki kharabiyan ek jagah — code, POS, inventory, bill, kahin bhi"
      />
      <ErrorsClient
        rows={dikhane}
        khuliGinti={khuli.length}
        kulGinti={sab.length}
        sabDikhayein={sabDikhayein}
      />
    </div>
  );
}
