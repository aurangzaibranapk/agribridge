"use client";
import { useState } from "react";
import { Building2, Store, Landmark, Handshake } from "lucide-react";

/**
 * Maal kahan se aayega, aur agar doosri shop se aa raha hai to paisa
 * kaise settle hoga. Dono jawab agri_orders ke maujooda khanon mein
 * jate hain: order_from_branch_id aur settlement_method.
 *
 * Approval chain (Sales > Finance > Manager) is se bilkul nahi badalti —
 * wo hamesha HQ hi karta hai. Sirf do cheezein badalti hain: dispatch
 * kaun karega, aur paisa kis ke khate mein jayega.
 */
interface Branch {
  id: string;
  name: string;
}

const SETTLEMENTS = [
  {
    value: "company_ledger",
    title: "Company Ke Zariye",
    detail: "Hisaab Company rakhegi. Dene wali shop ke khate mein raqam jama hogi, lene wali shop Company ko degi.",
    Icon: Landmark,
  },
  {
    value: "direct_branch",
    title: "Seedha Aapas Mein",
    detail: "Dono shops khud aapas mein hisaab karengi. Company ke khate mein koi entry nahi jayegi, sirf note rahega.",
    Icon: Handshake,
  },
] as const;

export function SourcingSelect({ branches, excludeBranchId }: { branches: Branch[]; excludeBranchId?: string }) {
  const [fromKind, setFromKind] = useState<"company" | "branch">("company");
  const [branchId, setBranchId] = useState("");
  const [settlement, setSettlement] = useState("company_ledger");

  const options = branches.filter((b) => b.id !== excludeBranchId);
  const isBranch = fromKind === "branch";

  return (
    <div className="space-y-3">
      {/* Company chuni ho to ye khanay khali jate hain, taake order
          pehle ki tarah HQ se hi aaye. */}
      <input type="hidden" name="order_from_branch_id" value={isBranch ? branchId : ""} />
      <input type="hidden" name="settlement_method" value={isBranch ? settlement : ""} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setFromKind("company")}
          aria-pressed={!isBranch}
          className={`rounded-lg border p-3 text-left transition ${
            !isBranch ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-950/30" : "border-surface-200 hover:border-surface-300 dark:border-surface-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <Building2 className={`h-4 w-4 ${!isBranch ? "text-brand-600" : "text-surface-400"}`} />
            <span className="text-sm font-semibold text-surface-900 dark:text-white">Company Se</span>
          </span>
          <span className="mt-1 block text-xs text-surface-500">Maal HQ ke Central Warehouse se aayega — jaisa hamesha hota hai.</span>
        </button>

        <button
          type="button"
          onClick={() => setFromKind("branch")}
          aria-pressed={isBranch}
          className={`rounded-lg border p-3 text-left transition ${
            isBranch ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-950/30" : "border-surface-200 hover:border-surface-300 dark:border-surface-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <Store className={`h-4 w-4 ${isBranch ? "text-brand-600" : "text-surface-400"}`} />
            <span className="text-sm font-semibold text-surface-900 dark:text-white">Doosri Shop Se</span>
          </span>
          <span className="mt-1 block text-xs text-surface-500">Kisi aur shop ke stock se aayega. Wahi shop dispatch karegi.</span>
        </button>
      </div>

      {isBranch && (
        <div className="space-y-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <div>
            <label className="text-xs font-medium text-surface-600">Kaun Si Shop Se? *</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              <option value="">- Shop Chunein -</option>
              {options.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-surface-600">Paisa Kaise Settle Hoga? *</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SETTLEMENTS.map(({ value, title, detail, Icon }) => {
                const selected = settlement === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSettlement(value)}
                    aria-pressed={selected}
                    className={`rounded-lg border p-3 text-left transition ${
                      selected ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:bg-brand-950/30" : "border-surface-200 hover:border-surface-300 dark:border-surface-700"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${selected ? "text-brand-600" : "text-surface-400"}`} />
                      <span className="text-sm font-semibold text-surface-900 dark:text-white">{title}</span>
                    </span>
                    <span className="mt-1 block text-xs text-surface-500">{detail}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="rounded-lg bg-surface-50 p-2 text-xs text-surface-600 dark:bg-surface-800">
            Approval waisi hi rahegi — Sales, Finance aur Manager HQ hi karega. Sirf dispatch chuni hui shop karegi.
          </p>
        </div>
      )}
    </div>
  );
}
