import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

/** HR KPI forms ke chhote hisse. */
export const inputCls = "w-full rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm dark:border-surface-700 dark:bg-surface-900";
export const btnCls = "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800";
export const cardCls = "rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900";

const HR_ROLES = ["hr", "admin", "owner", "super_admin"];

/** Sirf HR/Admin/Owner. Baqi ko saaf paighaam (RLS bhi rokta hai). */
export async function requireHr(): Promise<{ me: string } | null> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return data?.is_active && HR_ROLES.includes(String(data.role)) ? { me: user.id } : null;
}

export function NoAccess() {
  return <p className="p-8 text-center text-surface-500">Ye safha sirf HR / Admin / Owner ke liye hai.</p>;
}

export function Flash({ sp }: { sp?: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp?.ok === "string" ? sp.ok : null;
  const err = typeof sp?.err === "string" ? sp.err : null;
  if (!ok && !err) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${err ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`} role="status">{err ?? ok}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function HrSubHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="font-display text-xl font-bold text-surface-900 dark:text-white">{title}</h1>
        <p className="text-sm text-surface-500">{sub}</p>
      </div>
      <a href="/admin/hr-dashboard" className="text-sm font-semibold text-brand-700 hover:underline">← HR Dashboard</a>
    </div>
  );
}

export async function staffOptions() {
  const sb = createClient();
  const { data } = await sb.from("staff_details").select("profile_id, profiles!staff_details_profile_id_fkey(full_name)").is("exit_date", null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({ id: r.profile_id as string, name: (r.profiles?.full_name as string) ?? "—" })).sort((a, b) => a.name.localeCompare(b.name));
}
