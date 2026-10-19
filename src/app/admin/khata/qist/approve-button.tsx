"use client";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { qistAction, type QistState } from "@/actions/qist";
import { Submit } from "@/components/payroll/ui";

export default function QistApproveButton({ planId }: { planId: string }) {
  const [s, a] = useFormState(qistAction, {} as QistState);
  return (
    <form action={a} className="flex items-center gap-2">
      <input type="hidden" name="plan_id" value={planId} /><input type="hidden" name="action" value="approve" />
      <Submit label="Manzoor" />
      {s.error && <span className="text-xs text-red-600">{s.error}</span>}
      {s.success && <span className="text-xs text-emerald-600">✓</span>}
    </form>
  );
}
