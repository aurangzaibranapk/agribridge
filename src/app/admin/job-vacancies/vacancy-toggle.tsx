"use client";
import { useFormState } from "react-dom";
import { toggleVacancyOpen, type ActionState } from "@/actions/jobs";

const initialState: ActionState = {};

export function VacancyToggle({ vacancyId, isOpen }: { vacancyId: string; isOpen: boolean }) {
  const [, formAction] = useFormState(toggleVacancyOpen, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="vacancy_id" value={vacancyId} />
      <input type="hidden" name="is_open" value={String(isOpen)} />
      <button
        type="submit"
        className={`rounded-full px-3 py-1 text-xs font-medium ${isOpen ? "bg-green-50 text-green-700" : "bg-surface-100 text-surface-500"}`}
      >
        {isOpen ? "Open" : "Closed"}
      </button>
    </form>
  );
}