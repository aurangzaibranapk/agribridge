"use client";
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

  function setBranch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("branch", value);
    else params.delete("branch");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => setBranch(e.target.value)}
      className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
    >
      <option value="">{t("rp_all_branches", lang)}</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}