import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCog, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ADMIN_NAV_GROUPS } from "@/components/layout/nav-items";
import { iconByName } from "@/lib/access/icons";

export const dynamic = "force-dynamic";

/**
 * Topbar ka search box.
 *
 * Pehla masla (15 September): safha tha hi nahi. Doosra masla (Boss, 19
 * September): "koi department ya kuch bhi search karein wo nahi aata" --
 * search sirf CODE wali purani fehrist (ADMIN_NAV_GROUPS) mein dekhta
 * tha, jabke asal menu database (features/dashboards) se banta hai. Aur
 * seedha substring hone ki wajah se "perchase" jaisi aam spelling se
 * "Purchases" kabhi nahi milta tha.
 *
 * Ab teen jagah dhoondta hai: departments (dashboards), safhe
 * (features), aur staff (profiles) -- aur har lafz par thori si spelling
 * ki ghalti maaf hai (edit distance).
 */

/** Do lafzon ka farq -- kitne harf badalne/ghatane/barhane paRenge. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

function wordMatches(word: string, text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes(word)) return true;
  // Chhote lafz par fuzzy nahi -- "ai" har cheez se mil jata.
  const maxDist = word.length >= 6 ? 2 : word.length >= 4 ? 1 : 0;
  if (maxDist === 0) return false;
  for (const token of t.split(/[^a-z0-9؀-ۿ]+/)) {
    if (!token || Math.abs(token.length - word.length) > maxDist) continue;
    if (editDistance(word, token) <= maxDist) return true;
  }
  return false;
}

function matchesQuery(q: string, fields: (string | null | undefined)[]): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => fields.some((f) => f && wordMatches(w, f)));
}

/** Sidebar wala hi naqsha: department ki sarkhi kahan le jati hai. */
function departmentHref(key: string): string {
  if (key === "master") return "/admin/command-center";
  if (key === "reports") return "/admin/reports";
  return `/admin/department-dashboard/${key}`;
}

export default async function AdminSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let pageMatches: { href: string; label: string; icon: string | null; description?: string | null }[] = [];
  let deptMatches: { key: string; label: string }[] = [];

  if (q) {
    try {
      const service = createServiceClient();
      const [{ data: features }, { data: dashboards }] = await Promise.all([
        service.from("features").select("key, label, label_en, label_ur, route, icon, description").eq("is_active", true),
        service.from("dashboards").select("key, label, label_en, label_ur").eq("is_active", true).order("sort_order"),
      ]);

      pageMatches = (features ?? [])
        .filter((f) => matchesQuery(q, [f.label, f.label_en, f.label_ur, f.key, f.route]))
        .slice(0, 30)
        .map((f) => ({ href: f.route, label: f.label, icon: f.icon, description: f.description }));

      deptMatches = (dashboards ?? [])
        .filter((d) => matchesQuery(q, [d.label, d.label_en, d.label_ur, d.key]))
        .slice(0, 10)
        .map((d) => ({ key: d.key, label: d.label }));
    } catch {
      // Database na mile to purani code wali fehrist -- khali nataij se
      // koi bhi fehrist behtar hai (wahi usool jo loadNav ka hai).
      pageMatches = ADMIN_NAV_GROUPS.flatMap((g) => g.items)
        .filter((item) => matchesQuery(q, [item.label, item.href]))
        .slice(0, 30)
        .map((item) => ({ href: item.href, label: item.label, icon: item.icon.displayName ?? null }));
    }
  }

  let staffMatches: { id: string; full_name: string | null; role: string; phone_number: string | null; is_active: boolean | null }[] = [];
  if (q) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, phone_number, is_active")
      .or(`full_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .order("full_name")
      .limit(30);
    staffMatches = data ?? [];
  }

  return (
    <div>
      <PageHeader
        title="Search"
        description={q ? `"${q}" ke liye nataij` : "Upar search box mein safhe, department ya staff ka naam likhein."}
      />
      {!q ? (
        <Card>
          <p className="text-sm text-surface-500">Kuch likhein taake dhoondna shuru ho.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {deptMatches.length > 0 && (
            <Card>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
                Departments ({deptMatches.length})
              </p>
              <div className="space-y-1">
                {deptMatches.map((d) => (
                  <Link
                    key={d.key}
                    href={departmentHref(d.key)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <LayoutGrid className="h-4 w-4 text-surface-400" /> {d.label}
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Menu / Safhe ({pageMatches.length})</p>
            {pageMatches.length === 0 ? (
              <p className="text-sm text-surface-400">Koi safha nahi mila.</p>
            ) : (
              <div className="space-y-1">
                {pageMatches.map((item) => {
                  const Icon = iconByName(item.icon);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
                      <span>
                        {item.label}
                        {item.description && (
                          <span className="block text-xs text-surface-400">{item.description}</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">
              Staff / Users ({staffMatches.length})
            </p>
            {staffMatches.length === 0 ? (
              <p className="text-sm text-surface-400">Koi staff/user nahi mila.</p>
            ) : (
              <div className="space-y-1">
                {staffMatches.map((s) => (
                  <Link
                    key={s.id}
                    href="/admin/users"
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <span className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-surface-400" />
                      {s.full_name ?? "—"}
                      <span className="text-xs capitalize text-surface-400">({s.role})</span>
                      {s.phone_number && <span className="text-xs text-surface-400">{s.phone_number}</span>}
                    </span>
                    {s.is_active === false && (
                      <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-500 dark:bg-surface-800">Band</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
