"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleUserActive } from "@/actions/users";
import { Badge } from "@/components/ui/form";

export function ActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleUserActive(userId, !isActive);
      router.refresh();
    });
  }

  return (
    <button onClick={handleClick} disabled={pending}>
      <Badge tone={isActive ? "green" : "gray"}>{isActive ? "Active" : "Inactive"}</Badge>
    </button>
  );
}
