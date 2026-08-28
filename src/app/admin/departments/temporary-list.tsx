import { createServiceClient } from "@/lib/supabase/service";
import { Card } from "@/components/ui/layout-primitives";
import { ACTION_LABEL, SCOPE_LABEL, type Action } from "@/lib/access/types";
import { Clock } from "lucide-react";

/**
 * Waqti ijazat ka record.
 *
 * Dena aasan hota hai, wapas lena mushkil -- kyunke wapas lena kisi ko
 * yaad nahi rehta. Waqt database mein darj hai aur khud khatam ho jata
 * hai, magar ye fehrist phir bhi zaroori hai: kisi ne kisi ko kya diya,
 * kab tak, aur kyun. Ye sawal hamesha baad mein poochha jata hai, jab
 * kuch ghalat ho chuka hota hai.
 */
export async function TemporaryList() {
  const service = createServiceClient();

  const { data: rows } = await service
    .from("user_feature_permissions")
    .select("id, profile_id, feature_key, actions, data_scope, starts_at, expires_at, reason, granted_by, created_at")
    .not("expires_at", "is", null)
    .order("expires_at");

  if (!rows || rows.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-surface-400">
        Abhi koi waqti ijazat chal nahi rahi.
      </Card>
    );
  }

  const ids = [...new Set(rows.flatMap((r) => [r.profile_id, r.granted_by].filter(Boolean) as string[]))];
  const [{ data: people }, { data: features }] = await Promise.all([
    service.from("profiles").select("id, full_name").in("id", ids),
    service.from("features").select("key, label"),
  ]);

  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  const labelOf = new Map((features ?? []).map((f) => [f.key, f.label]));
  const now = Date.now();

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-surface-100 dark:divide-surface-800">
        {rows.map((row) => {
          const expires = row.expires_at ? new Date(row.expires_at) : null;
          const expired = expires ? expires.getTime() <= now : false;
          const daysLeft = expires ? Math.ceil((expires.getTime() - now) / 86_400_000) : null;

          return (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                    {nameOf.get(row.profile_id) ?? "—"} — {labelOf.get(row.feature_key) ?? row.feature_key}
                  </p>
                  <p className="text-xs text-surface-500">
                    {((row.actions as string[]) ?? [])
                      .map((a) => ACTION_LABEL[a as Action] ?? a)
                      .join(", ")}{" "}
                    • {SCOPE_LABEL[row.data_scope as keyof typeof SCOPE_LABEL] ?? row.data_scope}
                  </p>
                  <p className="text-xs text-surface-400">
                    Diya: {row.granted_by ? (nameOf.get(row.granted_by) ?? "—") : "—"}
                    {row.reason && ` • ${row.reason}`}
                  </p>
                </div>

                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                    expired
                      ? "bg-surface-100 text-surface-500 dark:bg-surface-800"
                      : (daysLeft ?? 99) <= 2
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
                        : "bg-green-50 text-green-700 dark:bg-green-950/30"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {expired
                    ? "Khatam ho chuki"
                    : daysLeft === 0
                      ? "Aaj khatam"
                      : `${daysLeft} din baqi`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-surface-200 px-4 py-2 text-xs text-surface-400 dark:border-surface-800">
        Khatam ho chuki ijazat khud-ba-khud band ho jati hai — use hataane ki zarurat nahi. Wo yahan
        record ke liye nazar aati rehti hai.
      </p>
    </Card>
  );
}
