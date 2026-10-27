"use server";

import { commitLoginPlace, readPlaceForm, type PlaceActionState } from "@/lib/access/commit-login-place";

export type { PlaceActionState };

/** Users wale card se: shaakh aur dukan ek hi mehfooz par. */
export async function assignLoginPlace(_prev: PlaceActionState, formData: FormData): Promise<PlaceActionState> {
  const form = readPlaceForm(formData);
  return commitLoginPlace({
    userId: form.userId,
    policy: "both",
    branchId: form.branchId,
    shopId: form.shopId,
  });
}
