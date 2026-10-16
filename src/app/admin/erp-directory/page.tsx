"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/layout-primitives";
import { Search, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ERP_FEATURES as ALL_FEATURES, isNewFeature as isNew } from "@/lib/erp-directory";



const SECTIONS = ["Sab", "🆕 Naya", ...Array.from(new Set(ALL_FEATURES.map((f) => f.section)))];

const SECTION_COLORS: Record<string, string> = {
  "Master Command": "bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300",
  Business: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  Sales: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  Purchases: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  Inventory: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  Agriculture: "bg-lime-100 text-lime-800 dark:bg-lime-950/40 dark:text-lime-300",
  Dairy: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
  Finance: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  Rates: "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
  Reports: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  "Website CMS": "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  Administration: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

export default function ErpDirectoryPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("Sab");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_FEATURES.filter((f) => {
      const sectionOk = activeSection === "Sab"
        ? true
        : activeSection === "🆕 Naya"
        ? isNew(f.addedDate)
        : f.section === activeSection;
      const textOk = !q || f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.section.toLowerCase().includes(q) || f.who.toLowerCase().includes(q);
      return sectionOk && textOk;
    });
  }, [search, activeSection]);

  return (
    <div className="space-y-0">
      <PageHeader
        title="ERP ka Naqsha"
        description={`Tamam ${ALL_FEATURES.length} features — section, naam, kaam, aur URL.`}
      />

      {/* Search + Filter */}
      <div className="sticky top-0 z-20 border-b border-surface-200 bg-white px-4 py-3 dark:border-surface-800 dark:bg-surface-950">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Feature dhundho — naam, kaam, kaun..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-surface-50 py-2 pl-9 pr-3 text-sm text-surface-900 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeSection === s
                    ? s === "🆕 Naya"
                      ? "bg-emerald-600 text-white"
                      : "bg-brand-600 text-white"
                    : s === "🆕 Naya"
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-surface-400">{filtered.length} feature mil{filtered.length === 1 ? "a" : "e"}</p>
      </div>

      {/* Table */}
      <div className="px-4 py-4">
        <div className="overflow-x-auto rounded-xl border border-surface-200 dark:border-surface-800">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-50 text-left text-xs font-semibold text-surface-500 dark:bg-surface-800">
                <th className="w-28 px-4 py-3">Section</th>
                <th className="w-52 px-4 py-3">Feature / Safha</th>
                <th className="px-4 py-3">Kaam kya hai</th>
                <th className="w-36 px-4 py-3">Kaun use kare</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-surface-400">
                    Koi feature nahi mila — search badlein ya section filter hataein.
                  </td>
                </tr>
              ) : (
                filtered.map((f, i) => (
                  <tr key={i} className={`border-t border-surface-100 transition-colors hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-900/50 ${isNew(f.addedDate) ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${SECTION_COLORS[f.section] ?? "bg-surface-100 text-surface-700"}`}>
                        {f.section}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-900 dark:text-white">{f.label}</span>
                        {isNew(f.addedDate) && (
                          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">NAYA</span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-surface-400">{f.href}</div>
                    </td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{f.description}</td>
                    <td className="px-4 py-3 text-xs text-surface-500">{f.who}</td>
                    <td className="px-4 py-3">
                      <Link href={f.href} className="rounded p-1 text-surface-400 hover:text-brand-600">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
