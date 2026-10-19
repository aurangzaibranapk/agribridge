"use client";
import { Trash2 } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { deleteFarmAction } from "./actions";

export function DeleteFarmButton({ farmId }: { farmId: string }) {
  const lang = useLang();
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("Kya aap sure hain? Ye farm delete ho jayegi.")) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteFarmAction} onSubmit={handleSubmit}>
      <input type="hidden" name="farm_id" value={farmId} />
      <button type="submit" aria-label={t("ph6_a_delete", lang)} className="text-red-500 hover:text-red-700">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}