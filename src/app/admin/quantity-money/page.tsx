import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { BookLossForm } from "./book-form";
import { quantityReport } from "@/lib/ledger/quantity-money";
import { AlertTriangle, CheckCircle2, Info, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance", "milk_collection"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

const MONTHS = [
  "Janwari", "Farwari", "March", "April", "Mai", "Joon",
  "Julai", "August", "Sitambar", "Aktubar", "Nawambar", "Disambar",
];

export default async function QuantityMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; y?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Finance, Manager aur Admin ke liye hai.</div>;
  }

  const now = new Date();
  const month = Number(params.m) || now.getMonth() + 1;
  const year = Number(params.y) || now.getFullYear();

  const report = await quantityReport({ month, year });
  const canBook = ["owner", "super_admin", "admin", "finance"].includes(me.role);

  const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
  const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Miqdar aur Paisa"
        description="Paise ka hisaab wo darj karta hai jo kisi ne kaha ke hua. Miqdar us hi waqie ka doosra, azad gawah hai."
      />

      {/* ---- Mahina chunna ---- */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/admin/quantity-money?m=${prev.m}&y=${prev.y}`}
          className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400"
        >
          ← {MONTHS[prev.m - 1]}
        </Link>
        <span className="text-sm font-semibold text-surface-900 dark:text-white">
          {MONTHS[month - 1]} {year}
        </span>
        <Link
          href={`/admin/quantity-money?m=${next.m}&y=${next.y}`}
          className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400"
        >
          {MONTHS[next.m - 1]} →
        </Link>
      </div>

      {/* ---- Chhupa hua nuqsan ---- */}
      <Card
        className={`p-4 ${
          report.hiddenLossValue > 0
            ? "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
            : "border-l-4 border-l-green-500"
        }`}
      >
        <div className="flex items-start gap-3">
          {report.hiddenLossValue > 0 ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {report.hiddenLossValue > 0
                ? `${rs(report.hiddenLossValue)} ka nuqsan abhi "khareed" ke andar chhupa hua hai`
                : "Koi chhupa hua nuqsan nahi"}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              Ye raqam ghayab nahi — wo kharch ho chuki hai aur ledger mein maujood hai. Masla ye hai ke
              wo khareed ke andar hai, jahan aam lagat jaisi nazar aati hai. Alag khane mein daalne se kul
              kharcha nahi badalta, magar nuqsan nazar aane lagta hai — aur jo nazar aata hai us par sawal
              ho sakta hai.
            </p>
          </div>
        </div>
      </Card>

      {/* ---- Har stream ---- */}
      <div className="grid gap-3 lg:grid-cols-2">
        {report.streams.map((s) => {
          const shortage = s.gap > 0;
          const meaningful = Math.abs(s.gapPercent) >= 0.5;

          return (
            <Card
              key={s.stream}
              className={`p-4 ${
                shortage && meaningful && !s.booked
                  ? "border-l-4 border-l-amber-500"
                  : "border-l-4 border-l-surface-200 dark:border-l-surface-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
                  <Scale className="h-4 w-4 shrink-0" /> {s.label}
                </h3>
                {s.booked && s.canBook && (
                  <span className="shrink-0 rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950/40 dark:text-green-400">
                    khate mein ja chuka
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-surface-200 px-2 py-2 dark:border-surface-800">
                  <p className="text-xs text-surface-500">{s.qtyInLabel}</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-surface-900 dark:text-white">
                    {s.qtyIn.toLocaleString()} {s.unit}
                  </p>
                </div>
                <div className="rounded-lg border border-surface-200 px-2 py-2 dark:border-surface-800">
                  <p className="text-xs text-surface-500">{s.qtyOutLabel}</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums text-surface-900 dark:text-white">
                    {s.qtyOut.toLocaleString()} {s.unit}
                  </p>
                </div>
                <div
                  className={`rounded-lg border px-2 py-2 ${
                    shortage && meaningful
                      ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                      : "border-surface-200 dark:border-surface-800"
                  }`}
                >
                  <p className="text-xs text-surface-500">Farq</p>
                  <p
                    className={`mt-0.5 text-sm font-medium tabular-nums ${
                      shortage && meaningful
                        ? "text-red-700 dark:text-red-400"
                        : "text-surface-900 dark:text-white"
                    }`}
                  >
                    {s.gap > 0 ? "−" : s.gap < 0 ? "+" : ""}
                    {Math.abs(s.gap).toLocaleString()} {s.unit}
                  </p>
                  {s.gapPercent !== 0 && (
                    <p className="text-xs text-surface-400">{Math.abs(s.gapPercent)}%</p>
                  )}
                </div>
              </div>

              {s.qtyIn > 0 && (
                <p className="mt-2 text-xs text-surface-600 dark:text-surface-400">
                  Fi {s.unit} lagat {rs(s.unitCost)} •{" "}
                  <span className={shortage && meaningful ? "font-medium text-red-700 dark:text-red-400" : ""}>
                    farq ki qeemat {rs(Math.abs(s.gapValue))}
                  </span>
                </p>
              )}

              {s.caveats.map((c, i) => (
                <p
                  key={i}
                  className="mt-2 flex items-start gap-1.5 rounded-lg bg-surface-100 px-2.5 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-400"
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{c}</span>
                </p>
              ))}

              {s.canBook && !s.booked && shortage && meaningful && canBook && (
                <BookLossForm stream={s.stream} month={month} year={year} />
              )}
            </Card>
          );
        })}
      </div>

      <p className="px-1 text-xs text-surface-400">
        Nuqsan alag karne par kul kharcha nahi badalta — raqam sirf &quot;khareed&quot; se nikal kar
        &quot;nuqsan&quot; mein jati hai. Ye entry ek mahine mein ek hi dafa ho sakti hai, aur badli nahi
        ja sakti.
      </p>
    </div>
  );
}
