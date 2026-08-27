"use client";
import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";
import { deleteBranch, type ActionState } from "@/actions/branches";

const initialState: ActionState = {};

export function DeleteBranchButton({ branchId }: { branchId: string }) {
  const [, formAction] = useFormState(deleteBranch, initialState);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("Kya aap sure hain? Ye branch delete ho jayegi.")) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <input type="hidden" name="branch_id" value={branchId} />
      <button type="submit" className="text-red-500 hover:text-red-700">
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}