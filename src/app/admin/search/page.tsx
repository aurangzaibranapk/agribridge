import Link from "next/link";
import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ADMIN_NAV_GROUPS } from "@/components/layout/nav-items";

export const dynamic = "force-dynamic";

/**
 * Topbar ka search box -- ab tak `/admin/search` par bhejta tha, jahan
 * koi safha tha hi nahi (malik, 15 September: "ye search bar kaam nahi
 * kar raha"). Do cheezon mein dhoondta hai -- jo malik ne khud kaha:
 * "admin user se kuch bhi search karein, sidebar ka kuch search karein".
 *
 * Naam se milan -- koi alag search index nahi, sirf profiles aur
 * sidebar ki apni fehrist (ADMIN_NAV_GROUPS) mein substring dhoondna.
 */
export default async function AdminSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const qLower = q.toLowerCase();
  const navMatches = q
    ? ADMIN_NAV_GROUPS.flatMap((g) => g.items).filter((item) => item.label.toLowerCase().includes(qLower)).slice(0, 30)
    : [];

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
        description={q ? `"${q}" ke liye nataij` : "Upar search box mein staff/user ka naam ya menu ka naam likhein."}
      />
      {!q ? (
        <Card>
          <p className="text-sm text-surface-500">Kuch likhein taake dhoondna shuru ho.</p>
        </Card>
      ) : (
        <div className="space-y-4">
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
          <Card>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Menu / Safhe ({navMatches.length})</p>
            {navMatches.length === 0 ? (
              <p className="text-sm text-surface-400">Koi safha nahi mila.</p>
            ) : (
              <div className="space-y-1">
                {navMatches.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <item.icon className="h-4 w-4 text-surface-400" /> {item.label}
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
