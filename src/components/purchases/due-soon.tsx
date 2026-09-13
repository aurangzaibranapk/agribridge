import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * "Agle 7 din mein kis ko kitna dena hai" (255).
 *
 * Finance ke dashboard par bhi aur supplier ke bill wale safhe par bhi
 * -- ek hi component, taake dono jagah ek hi jawab aaye.
 *
 * Ek purchase ka apna "baqi" yahan jaan boojh kar NAHI likha: adaigi
 * supplier ke khate par hoti hai, kisi ek bill par nahi. Ek bill ka
 * baqi ginna wo adad banana hai jo asal mein hai hi nahi. Is liye
 * saamne teen sachi cheezein hain: bill ka kul, is bill se juRi adaigi,
 * aur supplier ka kul dena.
 */
export async function DueSoon({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("v_supplier_due_calendar")
    .select("*")
    .lte("days_left", 7)
    .order("due_date")
    .limit(compact ? 6 : 60);

  const rows = data ?? [];
  const overdue = rows.filter((r) => Number(r.days_left ?? 0) < 0);
  const soonTotal = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return (
    <Card className={overdue.length > 0 ? "border-l-4 border-l-red-500" : ""}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CalendarClock className="h-4 w-4 text-surface-500" />
        <h2 className="text-sm font-semibold">{t("sb_due_7", lang)}</h2>
        {rows.length > 0 && (
          <span className="text-xs text-surface-500">
            {rows.length} · Rs {soonTotal.toLocaleString()}
          </span>
        )}
        {overdue.length > 0 && <Badge tone="red">{overdue.length} {t("sb_overdue", lang)}</Badge>}
        {compact && (
          <Link href="/admin/purchases/bills" className="ml-auto text-xs underline">
            {t("sb_due_title", lang)}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-surface-500">{t("sb_due_none", lang)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                <th className="py-1.5 pr-2">{t("sb_supplier", lang)}</th>
                <th className="py-1.5 pr-2">{t("sb_due_purchase", lang)}</th>
                <th className="py-1.5 pr-2">{t("sb_due_when", lang)}</th>
                <th className="py-1.5 pr-2 text-right">Rs</th>
                <th className="py-1.5 pr-2 text-right">{t("sb_paid_on_this", lang)}</th>
                <th className="py-1.5 text-right">{t("sb_supplier_total", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = Number(r.days_left ?? 0);
                return (
                  <tr key={r.purchase_id ?? r.purchase_number} className="border-b border-surface-100 align-top">
                    <td className="py-1.5 pr-2 font-medium">
                      {r.supplier_name}
                      {r.status === "pending" && (
                        <span className="ml-1.5 text-[11px] text-amber-700">· {t("sb_not_received", lang)}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-xs text-surface-600">{r.purchase_number}</td>
                    <td className="py-1.5 pr-2">
                      {d < 0 ? (
                        <span className="font-medium text-red-700">{t("sb_due_late", lang).replace("{n}", String(-d))}</span>
                      ) : d === 0 ? (
                        <span className="font-medium text-amber-700">{t("sb_due_today", lang)}</span>
                      ) : (
                        <span>{t("sb_due_days", lang).replace("{n}", String(d))}</span>
                      )}
                      <span className="block text-[11px] text-surface-400">{r.due_date}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{Number(r.total_amount ?? 0).toLocaleString()}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-surface-600">
                      {Number(r.paid_on_this ?? 0).toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {Number(r.supplier_payable ?? 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!compact && <p className="mt-2 text-xs text-surface-500">{t("sb_due_note", lang)}</p>}
        </div>
      )}
    </Card>
  );
}
