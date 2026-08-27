"use client";
import { Trash2 } from "lucide-react";
import { deleteFarmAction } from "./actions";

export function DeleteFarmButton({ farmId }: { farmId: string }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("Kya aap sure hain? Ye farm delete ho jayegi.")) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteFarmAction} onSubmit={handleSubmit}>
      <input type="hidden" name="farm_id" value={farmId} />
      <button type="submit" className="text-red-500 hover:text-red-700">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}