"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell({ initialCount, href }: { initialCount: number; href: string }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createClient();

    async function refreshCount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { count: liveCount } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", user.id)
        .eq("is_read", false);
      setCount(liveCount ?? 0);
    }

    const interval = setInterval(refreshCount, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href={href} className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}