"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, X, Store, Warehouse } from "lucide-react";
import {
  createPosCounter,
  setPosCounterStatus,
  assignCounterStaff,
  revokeCounterStaff,
  type ActionState,
} from "@/actions/pos-counters";

const KHALI: ActionState = {};

function Dabao({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "laal" | "khali" }) {
  const { pending } = useFormStatus();
  const rang =
    tone === "brand"
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : tone === "laal"
        ? "border border-red-200 text-red-700 hover:bg-red-50"
        : "border border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300";
  return (
    <button type="submit" disabled={pending} className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${rang}`}>
      {pending ? "..." : children}
    </button>
  );
}

interface Branch {
  id: string;
  name: string;
}
interface Shop {
  id: string;
  name: string;
  branch_id: string | null;
}
interface Staff {
  id: string;
  name: string;
  branch_id: string | null;
}
interface Counter {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  shopName: string;
  warehouseName: string;
  isActive: boolean;
  staff: { profileId: string; name: string }[];
}

export function PosCountersClient({
  branches,
  shops,
  staff,
  counters,
  singleBranchId,
}: {
  branches: Branch[];
  shops: Shop[];
  staff: Staff[];
  counters: Counter[];
  singleBranchId: string | null;
}) {
  const [createState, createAction] = useFormState(createPosCounter, KHALI);
  const [statusState, statusAction] = useFormState(setPosCounterStatus, KHALI);
  const [assignState, assignAction] = useFormState(assignCounterStaff, KHALI);
  const [revokeState, revokeAction] = useFormState(revokeCounterStaff, KHALI);

  const [newBranch, setNewBranch] = useState(singleBranchId ?? branches[0]?.id ?? "");
  const shopsForNewBranch = useMemo(() => shops.filter((s) => s.branch_id === newBranch), [shops, newBranch]);

  const paighaam = createState.message ?? statusState.message ?? assignState.message ?? revokeState.message;
  const kharabi = createState.error ?? statusState.error ?? assignState.error ?? revokeState.error;

  return (
    <div className="space-y-4">
      {(paighaam || kharabi) && (
        <div className={`rounded-lg px-3 py-2 text-sm ${kharabi ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {kharabi ?? paighaam}
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <Plus className="h-4 w-4" /> Naya Counter
        </p>
        <form action={createAction} className="flex flex-wrap items-end gap-2">
          {singleBranchId ? (
            <input type="hidden" name="branch_id" value={singleBranchId} />
          ) : (
            <div>
              <label className="block text-xs text-surface-500">Branch</label>
              <select
                name="branch_id"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-surface-500">Shop</label>
            <select
              name="shop_id"
              className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              {(singleBranchId ? shops.filter((s) => s.branch_id === singleBranchId) : shopsForNewBranch).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-surface-500">Counter ka naam</label>
            <input
              name="name"
              required
              placeholder="Karyana POS-01"
              className="rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <Dabao>Banayein</Dabao>
        </form>
      </div>

      <div className="space-y-2">
        {counters.length === 0 ? (
          <p className="text-sm text-surface-400">Abhi koi counter nahi bana.</p>
        ) : (
          counters.map((c) => {
            const branchStaff = staff.filter((s) => s.branch_id === c.branchId && !c.staff.some((a) => a.profileId === s.id));
            return (
              <div key={c.id} className="rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 font-medium text-surface-900 dark:text-white">
                      <Store className="h-4 w-4 text-brand-600" /> {c.name}
                      {!c.isActive && (
                        <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-500 dark:bg-surface-800">Band</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">
                      {c.branchName} → {c.shopName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-surface-400">
                      <Warehouse className="h-3 w-3" /> Stock Source: {c.warehouseName}
                    </p>
                  </div>
                  <form action={statusAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="is_active" value={(!c.isActive).toString()} />
                    <Dabao tone={c.isActive ? "laal" : "khali"}>{c.isActive ? "Band karein" : "Chalu karein"}</Dabao>
                  </form>
                </div>

                <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">Ijazat wale staff</p>
                  {c.staff.length === 0 ? (
                    <p className="mt-1 text-xs text-surface-400">Abhi kisi ko ijazat nahi.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.staff.map((s) => (
                        <span
                          key={s.profileId}
                          className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        >
                          {s.name}
                          <form action={revokeAction} className="inline">
                            <input type="hidden" name="counter_id" value={c.id} />
                            <input type="hidden" name="profile_id" value={s.profileId} />
                            <button type="submit" aria-label="Hatayein" className="hover:text-red-600">
                              <X className="h-3 w-3" />
                            </button>
                          </form>
                        </span>
                      ))}
                    </div>
                  )}
                  {branchStaff.length > 0 && (
                    <form action={assignAction} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="counter_id" value={c.id} />
                      <select
                        name="profile_id"
                        className="rounded-lg border border-surface-200 px-2 py-1 text-xs dark:border-surface-700 dark:bg-surface-900"
                      >
                        {branchStaff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <Dabao>Ijazat dein</Dabao>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
