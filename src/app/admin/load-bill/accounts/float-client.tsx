"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ArrowRightLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { rechargeFloat, type LoadState } from "@/actions/load-bill";

const initial: LoadState = {};

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Darj ho raha hai…" : "Float mein daalein"}
    </Button>
  );
}

export function FloatClient({
  accounts,
  financeAccounts,
  moves,
}: {
  providers: { id: string; name: string }[];
  accounts: { id: string; title: string; accountRef: string | null; providerName: string; float: number | null }[];
  financeAccounts: { id: string; name: string }[];
  moves: { id: string; account: string; kind: string; amount: number; reason: string | null; waqt: string }[];
}) {
  const [state, action] = useFormState(rechargeFloat, initial);

  return (
    <div className="space-y-4">
      {state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
          </p>
        </Card>
      )}
      {state.notice && !state.error && (
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20">
          <p className="flex items-start gap-2 text-sm text-brand-800 dark:text-brand-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.notice}
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="p-0">
          <p className="border-b border-surface-100 px-5 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
            Provider ke account
          </p>
          {accounts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-surface-500">
              Abhi koi account nahi. Account banane ka safha abhi nahi bana — is waqt account seedha
              database mein darj hota hai.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                  <tr>
                    <th className="px-4 py-2">Provider</th>
                    <th className="px-4 py-2">Account</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2 text-right">Float</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="px-4 py-2 font-medium">{a.providerName}</td>
                      <td className="px-4 py-2">{a.title}</td>
                      <td className="px-4 py-2 tabular-nums text-surface-500">{a.accountRef ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {a.float === null ? (
                          <span className="text-amber-700 dark:text-amber-400">parha nahi gaya</span>
                        ) : (
                          rs(a.float)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
            <ArrowRightLeft className="h-4 w-4 text-brand-600" /> Float mein paisa daalein
          </p>
          <p className="mb-3 text-[11px] leading-relaxed text-surface-500">
            Ye <b>kharcha nahi</b> — paisa sirf ek jagah se doosri jagah gaya. Bank/golak ghata, provider
            ke account mein utna hi barha.
          </p>

          <form action={action} className="space-y-3">
            <div>
              <Label htmlFor="account_id">Kis account mein</Label>
              <Select id="account_id" name="account_id" required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.providerName} — {a.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="finance_account_id">Paisa kahan se gaya</Label>
              <Select id="finance_account_id" name="finance_account_id" required>
                <option value="">— chunein —</option>
                {financeAccounts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Raqam</Label>
              <Input id="amount" name="amount" required inputMode="decimal" placeholder="30000" />
            </div>
            <div>
              <Label htmlFor="reason">Note (marzi ka)</Label>
              <Input id="reason" name="reason" placeholder="jaise: subah ka recharge" />
            </div>
            <Submit />
          </form>
        </Card>
      </div>

      <Card className="p-0">
        <p className="border-b border-surface-100 px-5 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
          Float ki aamad
        </p>
        {moves.length === 0 ? (
          <p className="px-5 py-6 text-sm text-surface-500">Abhi tak float mein koi paisa nahi dala gaya.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/50">
                <tr>
                  <th className="px-4 py-2">Tareekh</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Qism</th>
                  <th className="px-4 py-2 text-right">Raqam</th>
                  <th className="px-4 py-2">Wajah</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="px-4 py-2 text-xs tabular-nums text-surface-500">
                      {new Date(m.waqt).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-4 py-2">{m.account}</td>
                    <td className="px-4 py-2 text-xs">
                      {m.kind === "recharge" ? "Recharge" : "Milan ka farq"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{rs(m.amount)}</td>
                    <td className="px-4 py-2 text-xs text-surface-500">{m.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
