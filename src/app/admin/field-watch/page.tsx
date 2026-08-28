import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { collectWatchItems, countBySeverity, WATCH_KIND_LABEL, type WatchItem, type WatchKind } from "@/lib/field-watch";

export const dynamic = "force-dynamic";

const ADMIN_LEVEL = ["owner", "super_admin", "admin"];
const MANAGER_ROLES = [...ADMIN_LEVEL, "manager"];

export default async function FieldWatchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, branch_id, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !MANAGER_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Manager aur Admin ke liye hai.</div>;
  }

  // Branch manager sirf apni branch dekhta hai — jo cheez us ke ikhtiyar
  // mein nahi, us ka bojh us par dalne ka koi fayda nahi.
  const isAdminLevel = ADMIN_LEVEL.includes(me.role);
  const items = await collectWatchItems({ branchId: isAdminLevel ? null : me.branch_id });
  const { alerts, warnings } = countBySeverity(items);

  const grouped = new Map<WatchKind, WatchItem[]>();
  for (const item of items) {
    const list = grouped.get(item.kind) ?? [];
    list.push(item);
    grouped.set(item.kind, list);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Maidan ki Nigrani"
        description="Sab adhoori aur mashkook cheezein ek jagah — sab se purani sab se upar."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-surface-500">Fauri tawajjah</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{alerts}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Dekh lein</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{warnings}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Kul</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{items.length}</p>
        </Card>
      </div>

      {items.length === 0 && (
        <Card className="p-8">
          <EmptyState
            title="Filhal koi cheez tawajjah nahi mangti"
            description="Pichhle do hafton mein koi adhoori entry, ghair haazir meter ya door se lagi hazri nahi mili."
          />
        </Card>
      )}

      {[...grouped.entries()].map(([kind, list]) => (
        <Card key={kind} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{WATCH_KIND_LABEL[kind]}</h3>
            <Badge tone={list.some((i) => i.severity === "alert") ? "red" : "amber"}>{list.length}</Badge>
          </div>

          <ul className="divide-y divide-surface-200 dark:divide-surface-800">
            {list.map((item) => (
              <li key={item.id}>
                <Link href={item.link} className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-50 dark:hover:bg-surface-800/50">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${item.severity === "alert" ? "text-red-600" : "text-amber-500"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs text-surface-500">{item.detail}</p>
                    <p className="mt-1 text-xs text-surface-400">
                      {item.staffName} • {item.date}
                      {item.ageDays > 0 && ` • ${item.ageDays} din purani`}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-surface-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <p className="px-1 text-xs text-surface-400">
        Yahan koi nayi rok nahi lagti. Ye sirf wo baatein dikhata hai jo pehle se darj hain — faisla
        hamesha aap ka hai.
      </p>
    </div>
  );
}
