"use client";

import { useState, type ReactNode } from "react";
import { Package, Smartphone } from "lucide-react";

export function PosWorkspace({
  products,
  services,
}: {
  products: ReactNode;
  services: ReactNode;
}) {
  const [workspace, setWorkspace] = useState<"products" | "services">("products");

  return (
    <div className="min-h-0">
      <div className="mx-4 mt-3 flex w-fit items-center rounded-xl border border-surface-200 bg-white p-1 shadow-sm dark:border-surface-700 dark:bg-surface-900">
        <button
          type="button"
          onClick={() => setWorkspace("products")}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
            workspace === "products"
              ? "bg-brand-700 text-white shadow-sm"
              : "text-surface-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800"
          }`}
        >
          <Package className="h-4 w-4" />
          Product POS
        </button>
        <button
          type="button"
          onClick={() => setWorkspace("services")}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
            workspace === "services"
              ? "bg-brand-700 text-white shadow-sm"
              : "text-surface-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800"
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Load, Bill, Udhaar & Recovery
        </button>
      </div>

      <div className={workspace === "products" ? "block" : "hidden"}>{products}</div>
      <div className={workspace === "services" ? "block" : "hidden"}>{services}</div>
    </div>
  );
}
