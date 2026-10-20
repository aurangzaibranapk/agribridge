"use client";

import { useState } from "react";

export interface GrantManager {
  id: string;
  full_name: string;
  granted: boolean;
}

/** Owner/Admin ka toggle. Default band. Sirf Manager ke liye. */
export function ManagerGrantList({ managers, example = false, notice }: { managers: GrantManager[]; example?: boolean; notice?: string | null }) {
  const [rows, setRows] = useState(managers);
  const [msg, setMsg] = useState("");

  async function toggle(manager: GrantManager) {
    const next = !manager.granted;
    if (example) {
      setRows((list) => list.map((row) => row.id === manager.id ? { ...row, granted: next } : row));
      return;
    }
    const res = await fetch("/api/support/assign-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: manager.id, on: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error ?? "Ijazat save nahi hui."); return; }
    setRows((list) => list.map((row) => row.id === manager.id ? { ...row, granted: next } : row));
    setMsg(next ? `${manager.full_name} ab complaint assign kar sakta hai.` : `${manager.full_name} ki ijazat band kar di.`);
  }

  if (!notice && rows.length === 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Manager ki ijazat</h2>
      <p className="mt-0.5 text-xs text-surface-500">Complaint assign kar sakta hai — default band. Sirf Owner ya Admin ye toggle karta hai.</p>
      {notice && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{notice}</p>}
      {msg && <p className="mt-2 text-xs text-surface-600">{msg}</p>}
      <ul className="mt-3 divide-y divide-surface-100">
        {rows.map((manager) => (
          <li key={manager.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm">{manager.full_name}</span>
            <label className="flex items-center gap-2 text-[12px] text-surface-600">
              <input
                type="checkbox"
                checked={manager.granted}
                aria-label={`Complaint assign kar sakta hai ${manager.full_name}`}
                onChange={() => void toggle(manager)}
              />
              Complaint assign kar sakta hai
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
