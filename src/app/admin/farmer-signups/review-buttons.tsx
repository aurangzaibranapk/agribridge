"use client";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { reviewFarmerSignup, type SignupReviewState } from "@/actions/campaign-booking";

export function SignupReviewButtons({ farmerId }: { farmerId: string }) {
  const [state, action] = useFormState(reviewFarmerSignup, {} as SignupReviewState);
  if (state.success) return <span className="text-xs text-green-700">Ho gaya</span>;
  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="farmer_id" value={farmerId} />
      <button name="decision" value="approved" className="rounded bg-green-600 px-2 py-1 text-xs text-white">Approve</button>
      <button name="decision" value="rejected" className="rounded bg-red-600 px-2 py-1 text-xs text-white">Reject</button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
