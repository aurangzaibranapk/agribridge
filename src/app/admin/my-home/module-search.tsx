"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { iconByName } from "@/lib/access/icons";
import type { NavGroupData } from "@/lib/access/nav";

const GROUP_TONES = [
  "from-emerald-500 to-green-700",
  "from-blue-500 to-indigo-700",
  "from-amber-500 to-orange-700",
  "from-cyan-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-rose-500 to-red-700",
];

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function ModuleSearch({ groups }: { groups: NavGroupData[] }) {
  const [search, setSearch] = useState("");
  const query = normalize(search);

  const visibleGroups = useMemo(() => {
    if (!query) return groups;
    const words = query.split(" ").filter(Boolean);

    return groups
      .map((group) => {
        const groupText = normalize(`${group.label} ${group.key} ${group.description ?? ""}`);
        const wholeDepartmentMatches = words.every((word) => groupText.includes(word));
        const items = wholeDepartmentMatches
          ? group.items
          : group.items.filter((item) => {
              const itemText = normalize(
                `${group.label} ${group.key} ${item.label} ${item.description ?? ""} ${item.href}`
              );
              return words.every((word) => itemText.includes(word));
            });
        return items.length > 0 ? { ...group, items } : null;
      })
      .filter((group): group is NavGroupData => !!group);
  }, [groups, query]);

  const resultCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <div className="mb-6 rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm dark:border-emerald-900/40 dark:bg-surface-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Department, feature, route ya koi bhi lafz search karein..."
            aria-label="ERP modules search"
            className="h-12 w-full rounded-xl border border-surface-200 bg-surface-50 pl-12 pr-12 text-sm outline-none transition placeholder:text-surface-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-surface-700 dark:bg-surface-950 dark:focus:ring-emerald-950"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-surface-400 hover:bg-surface-200 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 px-1 text-xs text-surface-500 dark:text-surface-400">
          {query ? `${resultCount} matching module${resultCount === 1 ? "" : "s"} milay.` : "Kisi department ya kaam ka naam likhein — matching options neeche aa jayengi."}
        </p>
      </div>

      {query && visibleGroups.length === 0 && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          Is search ke mutabiq koi module nahi mila. Department, feature ya route ka doosra lafz likhein.
        </div>
      )}

      <div className="space-y-8">
        {visibleGroups.map((group, groupIndex) => {
          const tone = GROUP_TONES[groupIndex % GROUP_TONES.length];
          return (
            <section key={group.key}>
              <div className="mb-3 flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-sm`}>
                  <span className="text-xs font-bold">{group.items.length}</span>
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold">{group.label}</h2>
                  <p className="text-xs text-surface-500">{group.items.length} active options</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.items.map((item) => {
                  const Icon = iconByName(item.icon);
                  return (
                    <Link key={`${group.key}-${item.href}`} href={item.href} className="group rounded-2xl border border-surface-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg dark:border-surface-800 dark:bg-surface-900 dark:hover:border-emerald-700">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-sm`}><Icon className="h-5 w-5" /></span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</span>
                      </div>
                      <h3 className="mt-4 line-clamp-2 min-h-[2.75rem] text-base font-bold text-surface-900 dark:text-white">{item.label}</h3>
                      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-surface-500 dark:text-surface-400">{item.description || "Is module ka kaam khol kar dekhein."}</p>
                      <div className="mt-4 flex items-center justify-between border-t border-surface-100 pt-3 text-xs font-bold text-emerald-700 dark:border-surface-800 dark:text-emerald-300"><span>Open Module</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
