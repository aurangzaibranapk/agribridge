"use client";
import { useFormState, useFormStatus } from "react-dom";
import { cancelMyAccessRequest, type AccessState } from "@/actions/access-requests";
const initial: AccessState = {};
function B({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-1 text-xs text-surface-500 underline disabled:opacity-60">{label}</button>;
}
export function CancelButton({ id, label }: { id: string; label: string }) {
  const [state, action] = useFormState(cancelMyAccessRequest, initial);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <B label={label} />
      {state.error && <span className="ml-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
