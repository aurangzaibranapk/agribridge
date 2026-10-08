"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

export function BranchFilter({
  branches,
  current,
}: {
  branches: { id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const lang = useLang();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(current);

  useEffect(() => setDraft(current), [current]);

  function setBranch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("branch", value);
    else params.delete("branch");
    // Wahi cache wala masla jo DateRangeFilter mein tha (19 September).
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
      >
        <option value="">{t("rp_all_branches", lang)}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setBranch(draft)} disabled={draft === current} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">Apply</button>
    </div>
  );
}
