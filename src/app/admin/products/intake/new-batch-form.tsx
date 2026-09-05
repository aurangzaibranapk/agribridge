"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createIntakeBatch, type IntakeState } from "@/actions/product-intake";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initial: IntakeState = {};

function Submit() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> {pending ? "…" : t("pf_start", lang)}
      </span>
    </Button>
  );
}

export function NewBatchForm({ warehouses }: { warehouses: { id: string; name: string; code: string | null }[] }) {
  const [state, action] = useFormState(createIntakeBatch, initial);
  const router = useRouter();
  const lang = useLang();

  // Chakkar khulte hi seedha us ke andar -- warna banda fehrist mein
  // usay dhoondta hai.
  useEffect(() => {
    if (state.batchId) router.push(`/admin/products/intake/${state.batchId}`);
  }, [state.batchId, router]);

  const main = warehouses.find((w) => w.code === "MAIN") ?? warehouses[0];

  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <div>
          <Label htmlFor="bname">{t("pf_batch_name", lang)}</Label>
          <Input
            id="bname"
            name="name"
            required
            placeholder={`${new Date().toLocaleDateString("en-GB")} ${t("pf_ka_maal", lang)}`}
          />
        </div>
        <div>
          <Label htmlFor="wh">{t("pf_where_goods", lang)}</Label>
          <Select id="wh" name="warehouse_id" defaultValue={main?.id ?? ""} required className="w-full">
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.code === "MAIN" ? " (Main)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Submit />
        </div>
        {state.error && <p className="text-sm text-red-700 sm:col-span-3">{state.error}</p>}
      </form>
    </Card>
  );
}
